const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GameLeaderboard", function () {
  let gameLeaderboard;
  let owner;
  let player1;
  let player2;
  let player3;
  let scoreSigner;
  let relayer;
  let nonSigner;

  const MAX_SCORE = 50000;

  beforeEach(async function () {
    [owner, player1, player2, player3, scoreSigner, relayer, nonSigner] = await ethers.getSigners();

    const GameLeaderboard = await ethers.getContractFactory("GameLeaderboard");
    gameLeaderboard = await GameLeaderboard.deploy();
    await gameLeaderboard.waitForDeployment();

    // Set score signer
    await gameLeaderboard.connect(owner).setScoreSigner(scoreSigner.address);
    // Set relayer
    await gameLeaderboard.connect(owner).setRelayer(relayer.address, true);
  });

  // ============================================================================
  // WALLET LINKING TESTS
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
  // DAILY CHECK-IN TESTS
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
      await gameLeaderboard.connect(player1).dailyCheckIn();

      // Advance time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine");

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

    it("Should reset streak on missed day but NOT wipe best score", async function () {
      await gameLeaderboard.connect(player1).dailyCheckIn();

      // Submit a score first
      const score = 1000;
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );
      await gameLeaderboard.connect(player1).submitScore(score, nonce, signature);

      // Advance time by 3 days (miss a day)
      await ethers.provider.send("evm_increaseTime", [259200]);
      await ethers.provider.send("evm_mine");

      // Check-in after missed day
      await gameLeaderboard.connect(player1).dailyCheckIn();

      const [, streak, isActive] = await gameLeaderboard.getCheckInStatus(player1.address);
      expect(streak).to.equal(1n); // Reset to 1

      // CRITICAL: Best score should NOT be wiped
      const bestScore = await gameLeaderboard.playerBestScore(player1.address);
      expect(bestScore).to.equal(1000n);
    });

    it("Should allow check-in without linked FID", async function () {
      // player2 has no linked wallet — should still work
      const tx = await gameLeaderboard.connect(player2).dailyCheckIn();
      await tx.wait();

      const [, streak, isActive] = await gameLeaderboard.getCheckInStatus(player2.address);
      expect(streak).to.equal(1n);
      expect(isActive).to.be.true;
    });
  });

  // ============================================================================
  // SCORE SUBMISSION WITH SIGNATURE VERIFICATION
  // ============================================================================

  async function getValidSignature(contract, signer, playerAddress, scoreValue, nonce) {
    const contractAddress = await contract.getAddress();
    const chainId = BigInt((await ethers.provider.getNetwork()).chainId);

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "address", "uint256", "uint256"],
      [contractAddress, chainId, playerAddress, scoreValue, nonce]
    );

    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    return signature;
  }

  describe("Score Submission with Signature Verification", function () {
    const fid = 12345;
    const score = 1000;

    beforeEach(async function () {
      await gameLeaderboard.connect(player1).linkWallet(fid);
      await gameLeaderboard.connect(player1).dailyCheckIn();
    });

    it("Should accept score with valid signature", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );

      const tx = await gameLeaderboard.connect(player1).submitScore(score, nonce, signature);
      await tx.wait();

      const [, bestScore] = await gameLeaderboard.getPlayerRank(player1.address);
      expect(bestScore).to.equal(score);
    });

    it("Should reject score with invalid signature", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, nonSigner, player1.address, score, nonce
      );

      await expect(
        gameLeaderboard.connect(player1).submitScore(score, nonce, signature)
      ).to.be.reverted;
    });

    it("Should reject score with wrong nonce", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );
      const wrongNonce = nonce + 1n;

      await expect(
        gameLeaderboard.connect(player1).submitScore(score, wrongNonce, signature)
      ).to.be.reverted;
    });

    it("Should increment nonce after successful submission", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );

      await gameLeaderboard.connect(player1).submitScore(score, nonce, signature);

      const newNonce = await gameLeaderboard.scoreNonces(player1.address);
      expect(newNonce).to.equal(nonce + 1n);
    });

    it("Should reject score that is not better than best", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );
      await gameLeaderboard.connect(player1).submitScore(score, nonce, signature);

      const newNonce = await gameLeaderboard.scoreNonces(player1.address);
      const newSignature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score - 100, newNonce
      );

      await expect(
        gameLeaderboard.connect(player1).submitScore(score - 100, newNonce, newSignature)
      ).to.be.reverted;
    });

    it("Should reject score exceeding maximum", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, MAX_SCORE + 1, nonce
      );

      await expect(
        gameLeaderboard.connect(player1).submitScore(MAX_SCORE + 1, nonce, signature)
      ).to.be.reverted;
    });
  });

  // ============================================================================
  // GASLESS SCORE SUBMISSION (via Relayer)
  // ============================================================================

  describe("Gasless Score Submission (Relayer)", function () {
    const fid = 12345;
    const score = 2000;

    beforeEach(async function () {
      await gameLeaderboard.connect(player1).linkWallet(fid);
      await gameLeaderboard.connect(player1).dailyCheckIn();
    });

    it("Should allow relayer to submit score on behalf of player", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );

      const tx = await gameLeaderboard.connect(relayer).submitScoreFor(
        player1.address, score, nonce, signature
      );
      await tx.wait();

      const [, bestScore] = await gameLeaderboard.getPlayerRank(player1.address);
      expect(bestScore).to.equal(score);
    });

    it("Should allow owner to submit score on behalf of player", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );

      const tx = await gameLeaderboard.connect(owner).submitScoreFor(
        player1.address, score, nonce, signature
      );
      await tx.wait();

      const [, bestScore] = await gameLeaderboard.getPlayerRank(player1.address);
      expect(bestScore).to.equal(score);
    });

    it("Should prevent non-relayer/non-owner from submitting", async function () {
      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );

      await expect(
        gameLeaderboard.connect(player2).submitScoreFor(
          player1.address, score, nonce, signature
        )
      ).to.be.reverted;
    });

    it("Should allow revoking relayer access", async function () {
      await gameLeaderboard.connect(owner).setRelayer(relayer.address, false);

      const nonce = await gameLeaderboard.scoreNonces(player1.address);
      const signature = await getValidSignature(
        gameLeaderboard, scoreSigner, player1.address, score, nonce
      );

      await expect(
        gameLeaderboard.connect(relayer).submitScoreFor(
          player1.address, score, nonce, signature
        )
      ).to.be.reverted;
    });
  });

  // ============================================================================
  // LEADERBOARD TESTS
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
  // OWNERSHIP TESTS (Ownable2Step)
  // ============================================================================

  describe("Owner Functions (Ownable2Step)", function () {
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

    it("Should allow owner to set relayer", async function () {
      const tx = await gameLeaderboard.connect(owner).setRelayer(player3.address, true);
      await tx.wait();

      expect(await gameLeaderboard.isRelayer(player3.address)).to.be.true;
    });

    it("Should prevent non-owner from setting relayer", async function () {
      await expect(
        gameLeaderboard.connect(player1).setRelayer(player2.address, true)
      ).to.be.reverted;
    });

    it("Should allow owner to reset leaderboard", async function () {
      await gameLeaderboard.connect(owner).resetLeaderboard();

      const leaderboard = await gameLeaderboard.getLeaderboard(50);
      expect(leaderboard.length).to.equal(0);
    });

    it("Should prevent non-owner from resetting leaderboard", async function () {
      await expect(
        gameLeaderboard.connect(player1).resetLeaderboard()
      ).to.be.reverted;
    });

    it("Should support 2-step ownership transfer", async function () {
      // Step 1: Owner initiates transfer
      await gameLeaderboard.connect(owner).transferOwnership(player3.address);
      // Owner is still the owner
      expect(await gameLeaderboard.owner()).to.equal(owner.address);

      // Step 2: New owner accepts
      await gameLeaderboard.connect(player3).acceptOwnership();
      expect(await gameLeaderboard.owner()).to.equal(player3.address);
    });

    it("Should prevent random address from accepting ownership", async function () {
      await gameLeaderboard.connect(owner).transferOwnership(player3.address);

      await expect(
        gameLeaderboard.connect(player2).acceptOwnership()
      ).to.be.reverted;
    });
  });
});
