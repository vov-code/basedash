const { expect } = require("chai");

describe("GameLeaderboard - Basic Tests", function () {
  let gameLeaderboard;
  let owner;
  let player1;
  let scoreSigner;

  beforeEach(async function () {
    [owner, player1, scoreSigner] = await ethers.getSigners();

    const GameLeaderboard = await ethers.getContractFactory("GameLeaderboard");
    gameLeaderboard = await GameLeaderboard.deploy();
    await gameLeaderboard.waitForDeployment();

    await gameLeaderboard.connect(owner).setScoreSigner(scoreSigner.address);
  });

  describe("Basic Functionality", function () {
    it("Should deploy successfully", async function () {
      expect(await gameLeaderboard.owner()).to.equal(owner.address);
    });

    it("Should link FID to wallet", async function () {
      const fid = 12345;
      await gameLeaderboard.connect(player1).linkWallet(fid);
      
      const linkedAddress = await gameLeaderboard.fidToAddress(fid);
      expect(linkedAddress).to.equal(player1.address);
    });

    it("Should complete daily check-in", async function () {
      const fid = 12345;
      await gameLeaderboard.connect(player1).linkWallet(fid);
      await gameLeaderboard.connect(player1).dailyCheckIn();

      const [, streak, isActive] = await gameLeaderboard.getCheckInStatus(player1.address);
      expect(streak).to.equal(1n);
      expect(isActive).to.be.true;
    });

    it("Should allow owner to set score signer", async function () {
      const newSigner = scoreSigner.address;
      await gameLeaderboard.connect(owner).setScoreSigner(newSigner);
      expect(await gameLeaderboard.scoreSigner()).to.equal(newSigner);
    });

    it("Should prevent non-owner from setting score signer", async function () {
      try {
        await gameLeaderboard.connect(player1).setScoreSigner(player1.address);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Not owner");
      }
    });

    it("Should return empty leaderboard initially", async function () {
      const leaderboard = await gameLeaderboard.getLeaderboard(50);
      expect(leaderboard.length).to.equal(0);
    });

    it("Should get leaderboard size", async function () {
      const size = await gameLeaderboard.getLeaderboardSize();
      expect(size).to.equal(0n);
    });
  });
});
