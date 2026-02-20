const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GameLeaderboard", function () {
  let gameLeaderboard;
  let owner;
  let player1;
  let player2;
  let player3;
  let scoreSigner;
  let nonSigner;

  const MAX_SCORE = 50000;

  beforeEach(async function () {
    [owner, player1, player2, player3, scoreSigner, nonSigner] = await ethers.getSigners();

    const GameLeaderboard = await ethers.getContractFactory("GameLeaderboard");
    gameLeaderboard = await GameLeaderboard.deploy();
    await gameLeaderboard.waitForDeployment();

    // Устанавливаем score signer
    await gameLeaderboard.connect(owner).setScoreSigner(scoreSigner.address);
  });

  // ============================================================================
  // ТЕСТЫ ПРИВЯЗКИ КОШЕЛЬКА
  // ============================================================================

  describe("Wallet Linking", function () {
    it("Should link FID to wallet successfully", async function () {
      const fid = 12345;
      
      const tx = await gameLeaderboard.connect(player1).linkWallet(fid);
      await tx.wait();

      expect(await gameLeaderboard.fidToAddress(fid)).to.equal(player1.address);
      expect(await gameLeaderboard.addressToFid(player1.address)).to.equal(fid);
    });

    it("Should prevent linking already linked FID", async function () {
      const fid = 12345;
      
      await gameLeaderboard.connect(player1).linkWallet(fid);
      
      await expect(
        gameLeaderboard.connect(player2).linkWallet(fid)
      ).to.be.reverted;
    });

    it("Should prevent linking wallet that is already linked", async function () {
      const fid1 = 12345;
      const fid2 = 67890;
      
      await gameLeaderboard.connect(player1).linkWallet(fid1);
      
      await expect(
        gameLeaderboard.connect(player1).linkWallet(fid2)
      ).to.be.reverted;
    });
  });

  // ============================================================================
  // ТЕСТЫ DAILY CHECK-IN
  // ============================================================================

  describe("Daily Check-In", function () {
    const fid = 12345;

    beforeEach(async function () {
      await gameLeaderboard.connect(player1).linkWallet(fid);
    });

    it("Should complete daily check-in and start streak", async function () {
      const tx = await gameLeaderboard.connect(player1).dailyCheckIn();
      await tx.wait();

      const [, streak, isActive] = await gameLeaderboard.getCheckInStatus(player1.address);
      expect(streak).to.equal(1n);
      expect(isActive).to.be.true;
    });

    it("Should increase streak on consecutive day check-in", async function () {
      // Первый check-in
      await gameLeaderboard.connect(player1).dailyCheckIn();
      
      // Мотивируем время на 1 день
      await ethers.provider.send("evm_increaseTime", [86400]); // 24 часа
      await ethers.provider.send("evm_mine");

      // Второй check-in
      const tx = await gameLeaderboard.connect(player1).dailyCheckIn();
      await tx.wait();

      const [, streak, isActive] = await gameLeaderboard.getCheckInStatus(player1.address);
      expect(streak).to.equal(2n);
      expect(isActive).to.be.true;
    });

    it("Should prevent double check-in on same day", async function () {
      await gameLeaderboard.connect(player1).dailyCheckIn();
      
      await expect(
        gameLeaderboard.connect(player1).dailyCheckIn()
      ).to.be.reverted;
    });

    it("Should reset streak if day is missed", async function () {
      // Первый check-in
      await gameLeaderboard.connect(player1).dailyCheckIn();
      
      // Мотивируем время на 3 дня (пропуск дня)
      await ethers.provider.send("evm_increaseTime", [259200]); // 72 часа
      await ethers.provider.send("evm_mine");

      // Check-in после пропуска
      await gameLeaderboard.connect(player1).dailyCheckIn();

      const [, streak, isActive] = await gameLeaderboard.getCheckInStatus(player1.address);
      expect(streak).to.equal(1n); // Сброс до 1
      expect(isActive).to.be.true;
    });

    it("Should require wallet to be linked for check-in", async function () {
      await expect(
        gameLeaderboard.connect(player2).dailyCheckIn()
      ).to.be.reverted;
    });
  });

  // ============================================================================
  // ТЕСТЫ ОТПРАВКИ СЧЁТА С ВЕРИФИКАЦИЕЙ ПОДПИСИ
  // ============================================================================

  describe("Score Submission with Signature Verification", function () {
    const fid = 12345;
    const score = 1000;

    async function getValidSignature(playerAddress, scoreValue, nonce) {
      const contractAddress = await gameLeaderboard.getAddress();
      const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
      
      // Создаем хэш сообщения
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "address", "uint256", "uint256"],
        [contractAddress, chainId, playerAddress, scoreValue, nonce]
      );
      
      // Подписываем как Ethereum сообщение
      const ethSignedMessageHash = ethers.solidityPackedKeccak256(
        ["string", "bytes32"],
        ["\\x19Ethereum Signed Message:\\n32", messageHash]
      );
      
      const signature = await scoreSigner.signMessage(ethers.getBytes(ethSignedMessageHash));
      return signature;
    }

    beforeEach(async function () {
      await gameLeaderboard.connect(player1).linkWallet(fid);
      await gameLeaderboard.connect(player1).dailyCheckIn();
    });

    it("Should accept score with valid signature", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(player1.address, score, nonce);

      const tx = await gameLeaderboard.connect(player1).submitScore(score, nonce, signature);
      await tx.wait();

      const [, bestScore] = await gameLeaderboard.getPlayerRank(player1.address);
      expect(bestScore).to.equal(score);
    });

    it("Should reject score with invalid signature", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      
      // Подпись от неавторизованного signer
      const invalidSignature = await nonSigner.signMessage(
        ethers.getBytes(ethers.solidityPackedKeccak256(
          ["string", "bytes32"],
          ["\\x19Ethereum Signed Message:\\n32", ethers.solidityPackedKeccak256(
            ["address", "uint256", "address", "uint256", "uint256"],
            [await gameLeaderboard.getAddress(), BigInt((await ethers.provider.getNetwork()).chainId), player1.address, score, nonce]
          )]
        ))
      );

      await expect(
        gameLeaderboard.connect(player1).submitScore(score, nonce, invalidSignature)
      ).to.be.reverted;
    });

    it("Should reject score with wrong nonce", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(player1.address, score, nonce);
      const wrongNonce = nonce + 1n;

      await expect(
        gameLeaderboard.connect(player1).submitScore(score, wrongNonce, signature)
      ).to.be.reverted;
    });

    it("Should increment nonce after successful submission", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(player1.address, score, nonce);

      await gameLeaderboard.connect(player1).submitScore(score, nonce, signature);

      const newNonce = await gameLeaderboard.scoreNonces(player1.address);
      expect(newNonce).to.equal(nonce + 1n);
    });

    it("Should reject score that is not better than best", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(player1.address, score, nonce);
      await gameLeaderboard.connect(player1).submitScore(score, nonce, signature);

      const newNonce = await gameLeaderboard.scoreNonces(player1.address);
      const newSignature = await getValidSignature(player1.address, score - 100, newNonce);

      await expect(
        gameLeaderboard.connect(player1).submitScore(score - 100, newNonce, newSignature)
      ).to.be.reverted;
    });

    it("Should reject score exceeding maximum", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(player1.address, MAX_SCORE + 1, nonce);

      await expect(
        gameLeaderboard.connect(player1).submitScore(MAX_SCORE + 1, nonce, signature)
      ).to.be.reverted;
    });
  });

  // ============================================================================
  // ТЕСТЫ ЛИДЕРБОРДА
  // ============================================================================

  describe("Leaderboard", function () {
    it("Should return empty leaderboard initially", async function () {
      const leaderboard = await gameLeaderboard.getLeaderboard(50);
      expect(leaderboard.length).to.equal(0);
    });

    it("Should return correct player rank for non-existent player", async function () {
      const [rank, bestScore] = await gameLeaderboard.getPlayerRank(player1.address);
      expect(rank).to.equal(0n);
      expect(bestScore).to.equal(0n);
    });
  });

  // ============================================================================
  // ТЕСТЫ ВЛАДЕЛЬЦА
  // ============================================================================

  describe("Owner Functions", function () {
    it("Should allow owner to set score signer", async function () {
      const newSigner = player3.address;
      
      const tx = await gameLeaderboard.connect(owner).setScoreSigner(newSigner);
      await tx.wait();

      expect(await gameLeaderboard.scoreSigner()).to.equal(newSigner);
    });

    it("Should prevent non-owner from setting score signer", async function () {
      await expect(
        gameLeaderboard.connect(player1).setScoreSigner(player2.address)
      ).to.be.reverted;
    });

    it("Should allow owner to reset leaderboard", async function () {
      // Просто проверяем что функция работает
      await gameLeaderboard.connect(owner).resetLeaderboard();
      
      const leaderboard = await gameLeaderboard.getLeaderboard(50);
      expect(leaderboard.length).to.equal(0);
    });

    it("Should prevent non-owner from resetting leaderboard", async function () {
      await expect(
        gameLeaderboard.connect(player1).resetLeaderboard()
      ).to.be.reverted;
    });
  });
});
