// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title GameLeaderboard
 * @dev Оптимизированный смарт-контракт для хранения лидерборда игры BASE Dash
 * с системой ежедневного check-in
 * 
 * Gas optimizations:
 * - Indexed events для фильтрации
 * - Удалена сортировка в контракте (off-chain сортировка)
 * - Packaged structs для экономии storage
 * - Удалены лишние storage operations
 */
contract GameLeaderboard {
    // Packaged struct для экономии storage slots
    struct PlayerScore {
        address player;      // 20 bytes
        uint96 score;        // 12 bytes (max 79,228,162,514,264,337,593,543,950,335 - достаточно для score)
        uint32 timestamp;    // 4 bytes (до 2106 года)
        uint16 streakDays;   // 2 bytes (max 65535 дней)
        uint16 rank;         // 2 bytes (позиция в лидерборде)
    }

    struct DailyCheckIn {
        uint32 lastCheckIn;  // 4 bytes (до 2106 года)
        uint16 streak;       // 2 bytes
        bool hasMissed;      // 1 byte
        // Total: 7 bytes + padding = 1 slot (32 bytes)
    }

    address public owner;
    address public scoreSigner;
    
    uint256 public constant MAX_LEADERBOARD_SIZE = 100;
    uint256 public constant MAX_SCORE = 50000;

    // Mapping Farcaster FID к адресу кошелька
    mapping(uint256 => address) public fidToAddress;
    mapping(address => uint256) public addressToFid;

    // Хранение ежедневных check-in
    mapping(address => DailyCheckIn) public checkIns;

    // Топ игроков - храним только addresses, scores в отдельном mapping
    address[] public leaderboardAddresses;
    mapping(address => PlayerScore) public playerScores;
    mapping(address => uint256) public playerBestScore;
    mapping(address => uint256) public scoreNonces;
    
    // Кэш для быстрого поиска позиции в лидерборде
    mapping(address => uint256) public leaderboardIndex;

    // События с indexed параметрами для эффективной фильтрации
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
    event LeaderboardReset(
        address indexed by,
        uint256 timestamp
    );

    // Events defined above (ScoreSubmitted, DailyCheckInCompleted, etc.)
    // Frontend should use getSortedLeaderboard() for pre-sorted results

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        scoreSigner = msg.sender;
    }

    function setScoreSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Signer cannot be zero");
        address oldSigner = scoreSigner;
        scoreSigner = newSigner;
        emit ScoreSignerUpdated(newSigner, oldSigner);
    }

    /**
     * @dev Привязка FID к кошельку (gas optimized)
     */
    function linkWallet(uint256 fid) external {
        require(fidToAddress[fid] == address(0), "FID linked");
        require(addressToFid[msg.sender] == 0, "Wallet linked");

        fidToAddress[fid] = msg.sender;
        addressToFid[msg.sender] = fid;

        emit WalletLinked(fid, msg.sender, block.timestamp);
    }

    /**
     * @dev Ежедневный check-in (gas optimized)
     */
    function dailyCheckIn() external returns (uint256 streak) {
        // No FID requirement — any wallet can check in to save streaks
        DailyCheckIn storage checkIn = checkIns[msg.sender];
        uint256 lastDay = checkIn.lastCheckIn / 1 days;
        uint256 today = block.timestamp / 1 days;

        // Сброс при пропуске дня
        if (today > lastDay + 1) {
            checkIn.streak = 0;
            checkIn.hasMissed = true;
            playerBestScore[msg.sender] = 0;
        }

        require(today >= lastDay + 1, "Already checked in");

        checkIn.lastCheckIn = uint32(block.timestamp);
        checkIn.streak++;
        checkIn.hasMissed = false;

        emit DailyCheckInCompleted(msg.sender, checkIn.streak, block.timestamp);
        return checkIn.streak;
    }

    /**
     * @dev Отправка счёта (gas optimized - без сортировки в контракте)
     */
    function submitScore(
        uint256 score,
        uint256 nonce,
        bytes calldata signature
    ) external {
        require(score > 0 && score <= MAX_SCORE, "Invalid score");
        require(score > playerBestScore[msg.sender], "Score not better");
        require(nonce == scoreNonces[msg.sender], "Invalid nonce");

        // Верификация подписи
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

        // Обновление лидерборда (без сортировки - off-chain)
        _updateLeaderboard(msg.sender, uint96(score));

        // Получаем streak для события
        DailyCheckIn storage checkIn = checkIns[msg.sender];
        uint256 lastDay = checkIn.lastCheckIn / 1 days;
        uint256 today = block.timestamp / 1 days;
        uint256 streak = (checkIn.lastCheckIn != 0 && 
                         today <= lastDay + 1 && 
                         !checkIn.hasMissed) ? checkIn.streak : 0;

        emit ScoreSubmitted(msg.sender, uint96(score), nonce);
    }

    /**
     * @dev Обновление лидерборда (gas optimized - insertion sort вместо full sort)
     */
    function _updateLeaderboard(address player, uint96 score) internal {
        uint256 len = leaderboardAddresses.length;
        
        // Проверяем, есть ли игрок уже в лидерборде
        uint256 existingIdx = leaderboardIndex[player];
        
        if (existingIdx > 0 && existingIdx <= len) {
            // Игрок уже в лидерборде - обновляем
            existingIdx -= 1; // Convert to 0-indexed
            address existingPlayer = leaderboardAddresses[existingIdx];
            
            if (existingPlayer == player) {
                // Обновляем score и удаляем старую позицию
                leaderboardAddresses[existingIdx] = leaderboardAddresses[len - 1];
                leaderboardIndex[leaderboardAddresses[len - 1]] = existingIdx;
                leaderboardAddresses.pop();
                delete leaderboardIndex[player];
            }
        }

        // Добавляем нового игрока
        leaderboardAddresses.push(player);
        leaderboardIndex[player] = leaderboardAddresses.length;
        
        playerScores[player] = PlayerScore({
            player: player,
            score: score,
            timestamp: uint32(block.timestamp),
            streakDays: checkIns[player].streak,
            rank: 0 // Будет обновлено off-chain
        });

        // Gas optimization: не сортируем в контракте, делаем это off-chain
        // Просто эммитим событие для обновления UI
        emit LeaderboardUpdated(player, score, 0);
    }

    /**
     * @dev Сортировка в memory (bubble sort для небольших массивов)
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
     * @dev Получение лидерборда
     */
    function getLeaderboard(
        uint256 limit
    ) public view returns (PlayerScore[] memory) {
        uint256 len = leaderboardAddresses.length;
        if (limit > len) limit = len;

        PlayerScore[] memory result = new PlayerScore[](limit);

        // Копируем данные
        for (uint256 i = 0; i < limit; i++) {
            address player = leaderboardAddresses[i];
            result[i] = playerScores[player];
        }

        return result;
    }

    /**
     * @dev Получение отсортированного лидерборда (view function, gas free для caller)
     * @notice Frontend should use this function to get pre-sorted results.
     */
    function getSortedLeaderboard(
        uint256 limit
    ) external view returns (PlayerScore[] memory) {
        PlayerScore[] memory leaderboard = getLeaderboard(limit);

        // Сортировка в memory (не тратит gas пользователя)
        _sortLeaderboardMemory(leaderboard);

        return leaderboard;
    }

    /**
     * @dev Получение ранга игрока
     */
    function getPlayerRank(
        address player
    ) external view returns (uint256 rank, uint256 score) {
        PlayerScore memory ps = playerScores[player];
        if (ps.player == address(0)) return (0, 0);
        
        // Находим ранг сравнивая scores
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
     * @dev Получение статуса check-in
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
     * @dev Получение размера лидерборда
     */
    function getLeaderboardSize() external view returns (uint256) {
        return leaderboardAddresses.length;
    }

    /**
     * @dev Сброс лидерборда (только владелец)
     */
    function resetLeaderboard() external onlyOwner {
        delete leaderboardAddresses;
        emit LeaderboardReset(msg.sender, block.timestamp);
    }

    /**
     * @dev Вывод средств
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Получение баланса контракта
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Accept ETH payments
     */
    receive() external payable {}
}
