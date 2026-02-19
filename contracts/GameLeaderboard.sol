// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GameLeaderboard
 * @dev Смарт-контракт для хранения лидерборда игры BASE Dash
 * с системой ежедневного check-in
 */
contract GameLeaderboard {
    struct PlayerScore {
        address player;
        uint256 score;
        uint256 timestamp;
        uint256 streakDays;
    }
    
    struct DailyCheckIn {
        uint256 lastCheckIn;
        uint256 streak;
        bool hasMissed;
    }
    
    address public owner;
    address public scoreSigner;
    uint256 public constant MAX_LEADERBOARD_SIZE = 100;
    
    // Mapping Farcaster FID к адресу кошелька
    mapping(uint256 => address) public fidToAddress;
    mapping(address => uint256) public addressToFid;
    
    // Хранение ежедневных check-in
    mapping(address => DailyCheckIn) public checkIns;
    
    // Топ игроков
    PlayerScore[] public leaderboard;
    mapping(address => uint256) public playerBestScore;
    mapping(address => uint256) public scoreNonces;
    
    event ScoreSubmitted(address indexed player, uint256 score, uint256 streak);
    event DailyCheckInCompleted(address indexed player, uint256 streak);
    event WalletLinked(uint256 indexed fid, address indexed wallet);
    event LeaderboardUpdated(address indexed player, uint256 score, uint256 rank);
    event ScoreSignerUpdated(address indexed newSigner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier validScore(uint256 score) {
        require(score > 0, "Score must be positive");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        scoreSigner = msg.sender;
    }

    function setScoreSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Signer cannot be zero");
        scoreSigner = newSigner;
        emit ScoreSignerUpdated(newSigner);
    }

    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        // EIP-191
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
    
    /**
     * @dev Привязка FID к кошельку
     * @param fid Farcaster ID пользователя
     */
    function linkWallet(uint256 fid) external {
        require(fidToAddress[fid] == address(0), "FID already linked");
        require(addressToFid[msg.sender] == 0, "Wallet already linked");
        
        fidToAddress[fid] = msg.sender;
        addressToFid[msg.sender] = fid;
        
        emit WalletLinked(fid, msg.sender);
    }
    
    /**
     * @dev Ежедневный check-in (требуется подпись транзакции)
     * @return streak Текущая серия ежедневных входов
     */
    function dailyCheckIn() external returns (uint256 streak) {
        require(addressToFid[msg.sender] != 0, "Wallet not linked");
        
        DailyCheckIn storage checkIn = checkIns[msg.sender];
        uint256 lastDay = checkIn.lastCheckIn / 1 days;
        uint256 today = block.timestamp / 1 days;
        
        // Если пропустил день - сброс серии и очков
        if (today > lastDay + 1) {
            checkIn.streak = 0;
            checkIn.hasMissed = true;
            playerBestScore[msg.sender] = 0;
        }
        
        require(today >= lastDay + 1, "Already checked in today");
        
        checkIn.lastCheckIn = block.timestamp;
        checkIn.streak++;
        checkIn.hasMissed = false;
        
        emit DailyCheckInCompleted(msg.sender, checkIn.streak);
        return checkIn.streak;
    }
    
    /**
     * @dev Отправка счёта (только если есть активный check-in)
     * @param score Счёт игрока
     */
    function submitScore(uint256 score, uint256 nonce, bytes calldata signature) external validScore(score) {
        require(addressToFid[msg.sender] != 0, "Wallet not linked");
        
        DailyCheckIn storage checkIn = checkIns[msg.sender];
        uint256 lastDay = checkIn.lastCheckIn / 1 days;
        uint256 today = block.timestamp / 1 days;
        
        require(today <= lastDay + 1, "Missed daily check-in - score reset");
        require(score > playerBestScore[msg.sender], "Score not better than best");

        require(nonce == scoreNonces[msg.sender], "Invalid nonce");

        bytes32 msgHash = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                msg.sender,
                score,
                nonce
            )
        );
        bytes32 digest = _toEthSignedMessageHash(msgHash);
        address recovered = _recoverSigner(digest, signature);
        require(recovered == scoreSigner, "Invalid score signature");

        scoreNonces[msg.sender] = nonce + 1;
        
        playerBestScore[msg.sender] = score;
        
        // Добавление в лидерборд
        _updateLeaderboard(msg.sender, score);
        
        emit ScoreSubmitted(msg.sender, score, checkIn.streak);
    }
    
    /**
     * @dev Обновление лидерборда
     */
    function _updateLeaderboard(address player, uint256 score) internal {
        // Удаляем старую запись если есть
        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].player == player) {
                leaderboard[i] = leaderboard[leaderboard.length - 1];
                leaderboard.pop();
                break;
            }
        }
        
        // Добавляем новую
        leaderboard.push(PlayerScore({
            player: player,
            score: score,
            timestamp: block.timestamp,
            streakDays: checkIns[player].streak
        }));
        
        // Сортировка и обрезка
        _sortLeaderboard();
        if (leaderboard.length > MAX_LEADERBOARD_SIZE) {
            leaderboard.pop();
        }
        
        // Находим ранг игрока
        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].player == player) {
                emit LeaderboardUpdated(player, score, i + 1);
                break;
            }
        }
    }
    
    /**
     * @dev Сортировка лидерборда по убыванию очков
     */
    function _sortLeaderboard() internal {
        for (uint256 i = 0; i < leaderboard.length; i++) {
            for (uint256 j = i + 1; j < leaderboard.length; j++) {
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
     * @param limit Количество записей
     * @return Массив записей лидерборда
     */
    function getLeaderboard(uint256 limit) external view returns (PlayerScore[] memory) {
        if (limit > leaderboard.length) limit = leaderboard.length;
        PlayerScore[] memory result = new PlayerScore[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = leaderboard[i];
        }
        return result;
    }
    
    /**
     * @dev Получение ранга игрока
     * @param player Адрес игрока
     * @return Ранг и лучший счёт
     */
    function getPlayerRank(address player) external view returns (uint256, uint256) {
        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].player == player) {
                return (i + 1, leaderboard[i].score);
            }
        }
        return (0, 0);
    }
    
    /**
     * @dev Получение статуса check-in
     * @param player Адрес игрока
     * @return lastCheckIn Время последнего check-in
     * @return streak Текущая серия
     * @return isActive Активен ли статус (не пропустил ли день)
     */
    function getCheckInStatus(address player) external view returns (
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
            (today <= lastDay + 1) && !checkIn.hasMissed
        );
    }
    
    /**
     * @dev Получение размера лидерборда
     */
    function getLeaderboardSize() external view returns (uint256) {
        return leaderboard.length;
    }
    
    /**
     * @dev Сброс лидерборда (только владелец)
     */
    function resetLeaderboard() external onlyOwner {
        delete leaderboard;
    }
    
    /**
     * @dev Вывод средств (если контракт получает ETH)
     */
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
