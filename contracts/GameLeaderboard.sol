// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title GameLeaderboard
 * @dev Optimized smart contract for BASE Dash game leaderboard
 * with daily check-in system, role-based access, and gas-efficient storage.
 *
 * Security features:
 * - Ownable2Step for 2-phase ownership transfer (prevents accidental loss)
 * - Separate RELAYER_ROLE for gasless score submissions (not owner)
 * - Enforced MAX_LEADERBOARD_SIZE to prevent unbounded storage growth
 * - ECDSA signature verification for score integrity
 *
 * Gas optimizations:
 * - Indexed events for efficient filtering
 * - Off-chain sorting (no on-chain bubble sort on writes)
 * - Packed structs to minimize storage slots
 * - In-place leaderboard compaction
 */
contract GameLeaderboard is Ownable2Step {
    // Packed struct for storage slot efficiency
    struct PlayerScore {
        address player;      // 20 bytes
        uint96 score;        // 12 bytes (max ~79 billion — more than enough)
        uint32 timestamp;    // 4 bytes (valid until year 2106)
        uint16 streakDays;   // 2 bytes (max 65535 days)
        uint16 rank;         // 2 bytes (leaderboard position)
    }

    struct DailyCheckIn {
        uint32 lastCheckIn;  // 4 bytes (valid until year 2106)
        uint16 streak;       // 2 bytes
        bool hasMissed;      // 1 byte
        // Total: 7 bytes + padding = 1 slot (32 bytes)
    }

    address public scoreSigner;

    // Role: Relayer — can submit scores on behalf of players (gasless)
    // Separated from owner to limit blast radius if relayer key is compromised
    mapping(address => bool) public isRelayer;

    uint256 public constant MAX_LEADERBOARD_SIZE = 100;
    uint256 public constant MAX_SCORE = 50000;

    // Farcaster FID to wallet address mapping
    mapping(uint256 => address) public fidToAddress;
    mapping(address => uint256) public addressToFid;

    // Daily check-in storage
    mapping(address => DailyCheckIn) public checkIns;

    // Leaderboard: addresses array + per-player score data
    address[] public leaderboardAddresses;
    mapping(address => PlayerScore) public playerScores;
    mapping(address => uint256) public playerBestScore;
    mapping(address => uint256) public scoreNonces;

    // 1-indexed position cache for O(1) lookup
    mapping(address => uint256) public leaderboardIndex;

    // Track the minimum score on the leaderboard for efficient cap enforcement
    uint96 public minLeaderboardScore;

    // Events with indexed params for efficient log filtering
    event ScoreSubmitted(
        address indexed player,
        uint256 indexed score,
        uint256 streak,
        uint256 timestamp
    );
    event DailyCheckInCompleted(
        address indexed player,
        uint256 indexed streak,
        uint256 timestamp
    );
    event WalletLinked(
        uint256 indexed fid,
        address indexed wallet,
        uint256 timestamp
    );
    event LeaderboardUpdated(
        address indexed player,
        uint256 indexed score,
        uint256 indexed rank
    );
    event ScoreSignerUpdated(
        address indexed newSigner,
        address indexed oldSigner
    );
    event RelayerUpdated(
        address indexed relayer,
        bool indexed status
    );
    event LeaderboardReset(
        address indexed by,
        uint256 timestamp
    );

    modifier onlyRelayerOrOwner() {
        require(isRelayer[msg.sender] || msg.sender == owner(), "Not relayer or owner");
        _;
    }

    constructor() Ownable(msg.sender) {
        scoreSigner = msg.sender;
    }

    // ========================================================================
    // ADMIN FUNCTIONS
    // ========================================================================

    function setScoreSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Signer cannot be zero");
        address oldSigner = scoreSigner;
        scoreSigner = newSigner;
        emit ScoreSignerUpdated(newSigner, oldSigner);
    }

    /**
     * @dev Grant or revoke relayer role. Relayers can call submitScoreFor.
     *      Separating this from owner limits damage if the hot relayer key leaks.
     */
    function setRelayer(address relayer, bool status) external onlyOwner {
        require(relayer != address(0), "Relayer cannot be zero");
        isRelayer[relayer] = status;
        emit RelayerUpdated(relayer, status);
    }

    // ========================================================================
    // WALLET LINKING
    // ========================================================================

    /**
     * @dev Link a Farcaster FID to the caller's wallet (one-time binding)
     */
    function linkWallet(uint256 fid) external {
        require(fidToAddress[fid] == address(0), "FID linked");
        require(addressToFid[msg.sender] == 0, "Wallet linked");

        fidToAddress[fid] = msg.sender;
        addressToFid[msg.sender] = fid;

        emit WalletLinked(fid, msg.sender, block.timestamp);
    }

    // ========================================================================
    // DAILY CHECK-IN
    // ========================================================================

    /**
     * @dev Daily check-in — increments streak on consecutive days, resets on miss.
     *      FIX: Missing a day only resets the streak counter, NOT the player's best score.
     *      Scores are permanent achievements; streaks are multiplier incentives.
     */
    function dailyCheckIn() external returns (uint256 streak) {
        DailyCheckIn storage checkIn = checkIns[msg.sender];
        uint256 lastDay = checkIn.lastCheckIn / 1 days;
        uint256 today = block.timestamp / 1 days;

        // Reset streak on missed day (but DO NOT wipe best score)
        if (today > lastDay + 1) {
            checkIn.streak = 0;
            checkIn.hasMissed = true;
            // NOTE: playerBestScore is NOT reset — scores are permanent
        }

        require(today >= lastDay + 1, "Already checked in");

        checkIn.lastCheckIn = uint32(block.timestamp);
        checkIn.streak++;
        checkIn.hasMissed = false;

        emit DailyCheckInCompleted(msg.sender, checkIn.streak, block.timestamp);
        return checkIn.streak;
    }

    // ========================================================================
    // SCORE SUBMISSION
    // ========================================================================

    /**
     * @dev Submit score — player pays gas, verified via ECDSA signature
     */
    function submitScore(
        uint256 score,
        uint256 nonce,
        bytes calldata signature
    ) external {
        require(score > 0 && score <= MAX_SCORE, "Invalid score");
        require(score > playerBestScore[msg.sender], "Score not better");
        require(nonce == scoreNonces[msg.sender], "Invalid nonce");

        // Verify ECDSA signature from authorized signer
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                msg.sender,
                score,
                nonce
            )
        );
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(msgHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == scoreSigner, "Invalid signature");

        scoreNonces[msg.sender] = nonce + 1;
        playerBestScore[msg.sender] = score;

        // Update leaderboard with enforced size cap
        _updateLeaderboard(msg.sender, uint96(score));

        // Get streak for event emission
        DailyCheckIn storage checkIn = checkIns[msg.sender];
        uint256 lastDay = checkIn.lastCheckIn / 1 days;
        uint256 today = block.timestamp / 1 days;
        uint256 streak = (checkIn.lastCheckIn != 0 &&
                         today <= lastDay + 1 &&
                         !checkIn.hasMissed) ? checkIn.streak : 0;

        emit ScoreSubmitted(msg.sender, uint96(score), streak, block.timestamp);
    }

    /**
     * @dev Gasless score submission — relayer or owner pays gas on behalf of player.
     *      Uses separate RELAYER role to limit blast radius vs full owner access.
     */
    function submitScoreFor(
        address player,
        uint256 score,
        uint256 nonce,
        bytes calldata signature
    ) external onlyRelayerOrOwner {
        require(player != address(0), "Invalid player");
        require(score > 0 && score <= MAX_SCORE, "Invalid score");
        require(score > playerBestScore[player], "Score not better");
        require(nonce == scoreNonces[player], "Invalid nonce");

        // Verify ECDSA signature
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                player,
                score,
                nonce
            )
        );
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(msgHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == scoreSigner, "Invalid signature");

        scoreNonces[player] = nonce + 1;
        playerBestScore[player] = score;

        // Update leaderboard with enforced size cap
        _updateLeaderboard(player, uint96(score));

        // Get streak for event emission
        DailyCheckIn storage checkIn = checkIns[player];
        uint256 lastDay = checkIn.lastCheckIn / 1 days;
        uint256 today = block.timestamp / 1 days;
        uint256 streak = (checkIn.lastCheckIn != 0 &&
                         today <= lastDay + 1 &&
                         !checkIn.hasMissed) ? checkIn.streak : 0;

        emit ScoreSubmitted(player, score, streak, block.timestamp);
    }

    // ========================================================================
    // LEADERBOARD MANAGEMENT (with enforced MAX_LEADERBOARD_SIZE)
    // ========================================================================

    /**
     * @dev Update leaderboard with size cap enforcement.
     *      If leaderboard is full and new score doesn't beat the minimum, reject.
     *      Otherwise, replace the lowest-scoring entry.
     */
    function _updateLeaderboard(address player, uint96 score) internal {
        uint256 len = leaderboardAddresses.length;

        // Check if player already exists in leaderboard (1-indexed)
        uint256 existingIdx = leaderboardIndex[player];

        if (existingIdx > 0 && existingIdx <= len) {
            // Player already in leaderboard — remove old entry first
            uint256 zeroIdx = existingIdx - 1;
            address existingPlayer = leaderboardAddresses[zeroIdx];

            if (existingPlayer == player) {
                // Swap with last element and pop
                address lastPlayer = leaderboardAddresses[len - 1];
                leaderboardAddresses[zeroIdx] = lastPlayer;
                leaderboardIndex[lastPlayer] = existingIdx; // Keep 1-indexed
                leaderboardAddresses.pop();
                delete leaderboardIndex[player];
                len = leaderboardAddresses.length;
            }
        }

        // Enforce MAX_LEADERBOARD_SIZE cap
        if (len >= MAX_LEADERBOARD_SIZE) {
            // Find the player with the lowest score
            uint256 minIdx = 0;
            uint96 minScore = playerScores[leaderboardAddresses[0]].score;
            for (uint256 i = 1; i < len; i++) {
                uint96 s = playerScores[leaderboardAddresses[i]].score;
                if (s < minScore) {
                    minScore = s;
                    minIdx = i;
                }
            }

            // Only add if new score beats the minimum
            if (score <= minScore) {
                // Score not good enough for leaderboard — still save personal best
                return;
            }

            // Remove the lowest-scoring player to make room
            address evicted = leaderboardAddresses[minIdx];
            address lastPlayer = leaderboardAddresses[len - 1];
            leaderboardAddresses[minIdx] = lastPlayer;
            leaderboardIndex[lastPlayer] = minIdx + 1; // 1-indexed
            leaderboardAddresses.pop();
            delete leaderboardIndex[evicted];
            // Don't delete playerScores[evicted] — keep their personal record
        }

        // Add new player entry
        leaderboardAddresses.push(player);
        leaderboardIndex[player] = leaderboardAddresses.length; // 1-indexed

        playerScores[player] = PlayerScore({
            player: player,
            score: score,
            timestamp: uint32(block.timestamp),
            streakDays: checkIns[player].streak,
            rank: 0 // Updated off-chain
        });

        emit LeaderboardUpdated(player, score, 0);
    }

    // ========================================================================
    // VIEW FUNCTIONS (gas-free for callers)
    // ========================================================================

    /**
     * @dev Sort leaderboard in memory using bubble sort (small arrays only)
     */
    function _sortLeaderboardMemory(
        PlayerScore[] memory leaderboard
    ) internal pure {
        uint256 len = leaderboard.length;
        for (uint256 i = 0; i < len; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (leaderboard[j].score > leaderboard[i].score) {
                    PlayerScore memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;
                }
            }
        }
    }

    /**
     * @dev Get raw (unsorted) leaderboard data up to `limit` entries
     */
    function getLeaderboard(
        uint256 limit
    ) public view returns (PlayerScore[] memory) {
        uint256 len = leaderboardAddresses.length;
        if (limit > len) limit = len;

        PlayerScore[] memory result = new PlayerScore[](limit);
        for (uint256 i = 0; i < limit; i++) {
            address player = leaderboardAddresses[i];
            result[i] = playerScores[player];
        }
        return result;
    }

    /**
     * @dev Get sorted leaderboard (view function — gas-free for caller).
     *      Frontend should use this for pre-sorted results.
     */
    function getSortedLeaderboard(
        uint256 limit
    ) external view returns (PlayerScore[] memory) {
        PlayerScore[] memory leaderboard = getLeaderboard(limit);
        _sortLeaderboardMemory(leaderboard);
        return leaderboard;
    }

    /**
     * @dev Get a player's rank by comparing scores (1-indexed, 0 = not found)
     */
    function getPlayerRank(
        address player
    ) external view returns (uint256 rank, uint256 score) {
        PlayerScore memory ps = playerScores[player];
        if (ps.player == address(0)) return (0, 0);

        uint256 len = leaderboardAddresses.length;
        rank = 1;
        for (uint256 i = 0; i < len; i++) {
            if (playerScores[leaderboardAddresses[i]].score > ps.score) {
                rank++;
            }
        }
        return (rank, ps.score);
    }

    /**
     * @dev Get daily check-in status for a player
     */
    function getCheckInStatus(
        address player
    ) external view returns (
        uint256 lastCheckIn,
        uint256 streak,
        bool isActive
    ) {
        DailyCheckIn storage checkIn = checkIns[player];
        uint256 today = block.timestamp / 1 days;
        uint256 lastDay = checkIn.lastCheckIn / 1 days;

        return (
            checkIn.lastCheckIn,
            checkIn.streak,
            (checkIn.lastCheckIn != 0 && today <= lastDay + 1 && !checkIn.hasMissed)
        );
    }

    /**
     * @dev Get current leaderboard size
     */
    function getLeaderboardSize() external view returns (uint256) {
        return leaderboardAddresses.length;
    }

    // ========================================================================
    // ADMIN-ONLY STATE MANAGEMENT
    // ========================================================================

    /**
     * @dev Reset the entire leaderboard (owner only)
     */
    function resetLeaderboard() external onlyOwner {
        delete leaderboardAddresses;
        emit LeaderboardReset(msg.sender, block.timestamp);
    }

    /**
     * @dev Withdraw contract balance (owner only)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Get contract ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Accept ETH payments
     */
    receive() external payable {}
}
