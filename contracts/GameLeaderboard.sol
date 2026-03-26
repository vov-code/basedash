// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GameLeaderboard
 * @notice On-chain leaderboard for Base Dash — a Geometry Dash-inspired crypto runner game.
 *
 * Features:
 *  - Server-signed score submission (anti-cheat via ECDSA)
 *  - Gasless score submission (server pays gas via submitScoreFor)
 *  - Sorted leaderboard with configurable max size
 *  - Daily check-in streak system
 *  - Farcaster FID ↔ wallet linking
 *  - Owner admin: reset leaderboard, change signer, withdraw funds
 *
 * Deploy with Remix + Coinbase Wallet on Base Mainnet.
 * After deploy, call setScoreSigner(backendAddress) to enable score submission.
 */

// ============================================================================
//  OpenZeppelin-free ECDSA recovery (minimal, no imports needed for Remix)
// ============================================================================

library ECDSA {
    error ECDSAInvalidSignature();
    error ECDSAInvalidSignatureLength(uint256 length);
    error ECDSAInvalidSignatureS(bytes32 s);

    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            revert ECDSAInvalidSignatureLength(signature.length);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        // EIP-2: restrict s to lower half
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert ECDSAInvalidSignatureS(s);
        }

        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) {
            revert ECDSAInvalidSignature();
        }

        return signer;
    }

    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32 result) {
        assembly {
            mstore(0x00, "\x19Ethereum Signed Message:\n32")
            mstore(0x1c, hash)
            result := keccak256(0x00, 0x3c)
        }
    }
}

// ============================================================================
//  Main Contract
// ============================================================================

contract GameLeaderboard {
    using ECDSA for bytes32;

    // ── Types ───────────────────────────────────────────────────────────
    struct PlayerScore {
        address player;
        uint96  score;
        uint32  timestamp;
        uint16  streakDays;
        uint16  rank;
    }

    struct CheckIn {
        uint32 lastCheckIn;   // Unix timestamp (fits until year 2106)
        uint16 streak;        // Consecutive days
        bool   hasMissed;     // True if streak was broken
    }

    // ── Constants ───────────────────────────────────────────────────────
    uint256 public constant MAX_LEADERBOARD_SIZE = 100;
    uint256 public constant MAX_SCORE = 1_000_000_000; // 1 billion cap

    // ── State ───────────────────────────────────────────────────────────
    address public owner;
    address public scoreSigner;  // Backend wallet that signs valid scores

    // Leaderboard
    address[] public leaderboardAddresses;
    mapping(address => PlayerScore) public playerScores;
    mapping(address => uint256) public leaderboardIndex;  // 1-indexed (0 = not on board)
    mapping(address => uint256) public playerBestScore;

    // Anti-cheat nonces (prevents replay attacks)
    mapping(address => uint256) public scoreNonces;

    // Daily check-in
    mapping(address => CheckIn) public checkIns;

    // Farcaster integration
    mapping(uint256 => address) public fidToAddress;
    mapping(address => uint256) public addressToFid;

    // ── Events ──────────────────────────────────────────────────────────
    event ScoreSubmitted(
        address indexed player,
        uint256 indexed score,
        uint256 streak,
        uint256 timestamp
    );

    event LeaderboardUpdated(
        address indexed player,
        uint256 indexed score,
        uint256 indexed rank
    );

    event LeaderboardReset(
        address indexed by,
        uint256 timestamp
    );

    event DailyCheckInCompleted(
        address indexed player,
        uint256 indexed streak,
        uint256 timestamp
    );

    event ScoreSignerUpdated(
        address indexed newSigner,
        address indexed oldSigner
    );

    event WalletLinked(
        uint256 indexed fid,
        address indexed wallet,
        uint256 timestamp
    );

    // ── Modifiers ───────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Receive ETH ─────────────────────────────────────────────────────
    receive() external payable {}

    // ====================================================================
    //  SCORE SUBMISSION
    // ====================================================================

    /**
     * @notice Submit your own score with a server-signed proof.
     * @param score  The game score to record.
     * @param nonce  Must match the player's current nonce (prevents replays).
     * @param signature  ECDSA signature from the backend scoreSigner.
     */
    function submitScore(
        uint256 score,
        uint256 nonce,
        bytes calldata signature
    ) external {
        _submitScoreInternal(msg.sender, score, nonce, signature);
    }

    /**
     * @notice Gasless submission — the backend (or any relayer) submits on
     *         behalf of the player.  The signature still proves the
     *         scoreSigner approved this exact (player, score, nonce) tuple.
     */
    function submitScoreFor(
        address player,
        uint256 score,
        uint256 nonce,
        bytes calldata signature
    ) external {
        _submitScoreInternal(player, score, nonce, signature);
    }

    function _submitScoreInternal(
        address player,
        uint256 score,
        uint256 nonce,
        bytes calldata signature
    ) internal {
        require(player != address(0), "Invalid player");
        require(score > 0 && score <= MAX_SCORE, "Invalid score");
        require(nonce == scoreNonces[player], "Invalid nonce");
        require(scoreSigner != address(0), "Signer not set");

        // Verify ECDSA signature from backend
        bytes32 messageHash = keccak256(
            abi.encodePacked(player, score, nonce, block.chainid, address(this))
        );
        bytes32 ethHash = messageHash.toEthSignedMessageHash();
        address recovered = ethHash.recover(signature);
        require(recovered == scoreSigner, "Invalid signature");

        // Increment nonce (replay protection)
        scoreNonces[player] = nonce + 1;

        // Only update if this is a new high score
        if (score <= playerBestScore[player]) {
            return; // Not a new high score, skip leaderboard update
        }

        playerBestScore[player] = score;

        // Get current streak for this player
        uint16 streakDays = checkIns[player].streak;

        // Update or insert into leaderboard
        uint256 idx = leaderboardIndex[player];

        if (idx > 0) {
            // Player already on leaderboard — update score
            PlayerScore storage ps = playerScores[player];
            ps.score = uint96(score);
            ps.timestamp = uint32(block.timestamp);
            ps.streakDays = streakDays;
        } else {
            // New player
            PlayerScore memory newEntry = PlayerScore({
                player: player,
                score: uint96(score),
                timestamp: uint32(block.timestamp),
                streakDays: streakDays,
                rank: 0
            });

            playerScores[player] = newEntry;

            if (leaderboardAddresses.length < MAX_LEADERBOARD_SIZE) {
                // Board not full — just append
                leaderboardAddresses.push(player);
                leaderboardIndex[player] = leaderboardAddresses.length; // 1-indexed
            } else {
                // Board full — replace the lowest scorer
                (address lowest, uint256 lowestIdx) = _findLowestScorer();
                if (score > playerScores[lowest].score) {
                    // Remove old entry
                    leaderboardIndex[lowest] = 0;
                    // Replace with new
                    leaderboardAddresses[lowestIdx] = player;
                    leaderboardIndex[player] = lowestIdx + 1;
                }
            }
        }

        // Calculate rank for event
        uint256 rank = _calculateRank(player);

        emit ScoreSubmitted(player, score, streakDays, block.timestamp);
        emit LeaderboardUpdated(player, score, rank);
    }

    // ====================================================================
    //  DAILY CHECK-IN
    // ====================================================================

    /**
     * @notice Daily check-in — can be called once per UTC day.
     *         Builds a consecutive-day streak. Missing a day resets streak to 1.
     * @return streak The player's updated streak count.
     */
    function dailyCheckIn() external returns (uint256 streak) {
        CheckIn storage ci = checkIns[msg.sender];
        uint256 today = block.timestamp / 86400;
        uint256 lastDay = uint256(ci.lastCheckIn) / 86400;

        require(today > lastDay, "Already checked in today");

        if (today == lastDay + 1) {
            // Consecutive day
            ci.streak += 1;
            ci.hasMissed = false;
        } else {
            // Missed one or more days — reset
            ci.streak = 1;
            ci.hasMissed = true;
        }

        ci.lastCheckIn = uint32(block.timestamp);
        streak = ci.streak;

        // Update streak on leaderboard entry if player has one
        if (leaderboardIndex[msg.sender] > 0) {
            playerScores[msg.sender].streakDays = uint16(streak);
        }

        emit DailyCheckInCompleted(msg.sender, streak, block.timestamp);
    }

    // ====================================================================
    //  FARCASTER WALLET LINKING
    // ====================================================================

    /**
     * @notice Link a Farcaster FID to your wallet address.
     *         Overwrites any previous link for this FID or address.
     */
    function linkWallet(uint256 fid) external {
        require(fid > 0, "Invalid FID");

        // Clear old link if this address was linked to a different FID
        uint256 oldFid = addressToFid[msg.sender];
        if (oldFid > 0) {
            fidToAddress[oldFid] = address(0);
        }

        // Clear old link if this FID was linked to a different address
        address oldAddr = fidToAddress[fid];
        if (oldAddr != address(0)) {
            addressToFid[oldAddr] = 0;
        }

        // Create new link
        fidToAddress[fid] = msg.sender;
        addressToFid[msg.sender] = fid;

        emit WalletLinked(fid, msg.sender, block.timestamp);
    }

    // ====================================================================
    //  VIEW FUNCTIONS
    // ====================================================================

    /**
     * @notice Get the full leaderboard (unsorted), up to `limit` entries.
     */
    function getLeaderboard(uint256 limit) external view returns (PlayerScore[] memory) {
        uint256 len = leaderboardAddresses.length;
        if (limit < len) len = limit;

        PlayerScore[] memory result = new PlayerScore[](len);
        for (uint256 i = 0; i < len; i++) {
            address addr = leaderboardAddresses[i];
            result[i] = playerScores[addr];
            result[i].rank = uint16(i + 1);
        }
        return result;
    }

    /**
     * @notice Get the leaderboard sorted by score (descending).
     *         Uses in-memory insertion sort — O(n²) but fine for ≤100 entries.
     */
    function getSortedLeaderboard(uint256 limit) external view returns (PlayerScore[] memory) {
        uint256 len = leaderboardAddresses.length;

        // Build unsorted array
        PlayerScore[] memory all = new PlayerScore[](len);
        for (uint256 i = 0; i < len; i++) {
            address addr = leaderboardAddresses[i];
            all[i] = playerScores[addr];
        }

        // Insertion sort descending by score
        for (uint256 i = 1; i < len; i++) {
            PlayerScore memory key = all[i];
            uint256 j = i;
            while (j > 0 && all[j - 1].score < key.score) {
                all[j] = all[j - 1];
                j--;
            }
            all[j] = key;
        }

        // Assign ranks and trim to limit
        if (limit > len) limit = len;
        PlayerScore[] memory result = new PlayerScore[](limit);
        for (uint256 i = 0; i < limit; i++) {
            all[i].rank = uint16(i + 1);
            result[i] = all[i];
        }

        return result;
    }

    /**
     * @notice Get a player's current rank and score.
     *         Returns (0, 0) if the player is not on the leaderboard.
     */
    function getPlayerRank(address player) external view returns (uint256 rank, uint256 score) {
        score = playerBestScore[player];
        if (leaderboardIndex[player] == 0) {
            return (0, score);
        }

        // Count how many players have a higher score
        rank = 1;
        for (uint256 i = 0; i < leaderboardAddresses.length; i++) {
            if (playerScores[leaderboardAddresses[i]].score > uint96(score)) {
                rank++;
            }
        }
    }

    /**
     * @notice How many players are on the leaderboard.
     */
    function getLeaderboardSize() external view returns (uint256) {
        return leaderboardAddresses.length;
    }

    /**
     * @notice Get a player's daily check-in status.
     */
    function getCheckInStatus(address player) external view returns (
        uint256 lastCheckIn,
        uint256 streak,
        bool isActive
    ) {
        CheckIn storage ci = checkIns[player];
        lastCheckIn = ci.lastCheckIn;
        streak = ci.streak;

        // Active = checked in within the last 48 hours
        isActive = (block.timestamp - ci.lastCheckIn) < 172800;
    }

    /**
     * @notice Contract ETH balance (for owner monitoring).
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ====================================================================
    //  ADMIN FUNCTIONS (owner only)
    // ====================================================================

    /**
     * @notice Set the backend wallet that signs valid scores.
     *         MUST be called after deployment!
     */
    function setScoreSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer");
        address old = scoreSigner;
        scoreSigner = newSigner;
        emit ScoreSignerUpdated(newSigner, old);
    }

    /**
     * @notice Nuclear option — wipe the entire leaderboard.
     */
    function resetLeaderboard() external onlyOwner {
        for (uint256 i = 0; i < leaderboardAddresses.length; i++) {
            address addr = leaderboardAddresses[i];
            delete playerScores[addr];
            delete leaderboardIndex[addr];
            delete playerBestScore[addr];
        }
        delete leaderboardAddresses;
        emit LeaderboardReset(msg.sender, block.timestamp);
    }

    /**
     * @notice Withdraw any ETH sent to the contract.
     */
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No balance");
        (bool ok, ) = owner.call{value: bal}("");
        require(ok, "Transfer failed");
    }

    // ====================================================================
    //  INTERNAL HELPERS
    // ====================================================================

    function _findLowestScorer() internal view returns (address lowest, uint256 lowestIdx) {
        lowest = leaderboardAddresses[0];
        lowestIdx = 0;
        uint96 lowestScore = playerScores[lowest].score;

        for (uint256 i = 1; i < leaderboardAddresses.length; i++) {
            address addr = leaderboardAddresses[i];
            if (playerScores[addr].score < lowestScore) {
                lowest = addr;
                lowestIdx = i;
                lowestScore = playerScores[addr].score;
            }
        }
    }

    function _calculateRank(address player) internal view returns (uint256 rank) {
        uint96 playerScore = playerScores[player].score;
        rank = 1;
        for (uint256 i = 0; i < leaderboardAddresses.length; i++) {
            if (playerScores[leaderboardAddresses[i]].score > playerScore) {
                rank++;
            }
        }
    }
}
