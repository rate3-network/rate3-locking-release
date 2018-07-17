import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';
import { advanceBlock } from './helpers/advanceToBlock';

const RTELockingVault = artifacts.require("./RTELockingVault.sol");
const DemoRTEToken = artifacts.require("./DemoRTEToken.sol");

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

// Assumes the command: ganache-cli -e 100000
// 100000 default ether, 10 accounts created
contract('RTELockingVault Deposit/Withdraw Test', function (accounts) {
  // Contract init parameters
  const testSupply = new web3.BigNumber('100000000e+18');

  // Testnet account labelling
  const adminWallet = accounts[0];
  const rewardWallet = accounts[2];
  const testWallet1 = accounts[8];
  const testWallet2 = accounts[9];
  const testWallet3 = accounts[7];

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  describe('locking up tokens flow', function () {
    beforeEach(async function () {
      this.depositTime = latestTime() + duration.weeks(1);
      this.unlockTime = this.depositTime + duration.days(60);
      this.interestRate = 15;
      this.vaultLockDays = 60;
      this.cap = new web3.BigNumber('50000000e+18');
      this.minDeposit = new web3.BigNumber('100e+18');

      this.token = await DemoRTEToken.new();
      this.vault = await RTELockingVault.new(this.token.address, this.cap, this.minDeposit, this.interestRate, this.depositTime, this.unlockTime, this.vaultLockDays, rewardWallet);
      // Transfer test tokens to testwallets
      await this.token.transfer(testWallet1, testSupply);
      await this.token.transfer(testWallet2, new web3.BigNumber('10000000e+18'));
      await this.token.transfer(rewardWallet, testSupply);


      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18').mul(this.interestRate).div(36500).mul(this.vaultLockDays), { from: rewardWallet });
    });

    it('should accept lock tokens if balance available', async function () {
      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('1000000e+18'), { from: testWallet1 }).should.be.fulfilled;
    });

    it('should reject locking more tokens than self balance', async function () {
      await this.token.approve(this.vault.address, new web3.BigNumber('10000001e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('10000001e+18'), { from: testWallet2 }).should.be.rejected;
    });

    it('should reject lock tokens if deposit time is over', async function () {
      await increaseTimeTo(this.depositTime);
      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('1000000e+18'), { from: testWallet1 }).should.be.rejected;
    });

    it('should reject lock tokens if over cap', async function () {
      await this.token.approve(this.vault.address, new web3.BigNumber('60000000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('60000000e+18'), { from: testWallet1 }).should.be.rejected;
    });

    it('should reject lock tokens if below minimum', async function () {
      await this.token.approve(this.vault.address, new web3.BigNumber('99e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('99e+18'), { from: testWallet1 }).should.be.rejected;
    });
  });

  describe('withdrawing tokens flow', function () {
    beforeEach(async function () {
      this.depositTime = latestTime() + duration.weeks(1);
      this.unlockTime = this.depositTime + duration.days(60);
      this.interestRate = 15;
      this.vaultLockDays = 60;
      this.cap = new web3.BigNumber('50000000e+18');
      this.minDeposit = new web3.BigNumber('100e+18');

      this.token = await DemoRTEToken.new();
      this.vault = await RTELockingVault.new(this.token.address, this.cap, this.minDeposit, this.interestRate, this.depositTime, this.unlockTime, this.vaultLockDays, rewardWallet);
      // Transfer test tokens to testwallets
      await this.token.transfer(testWallet1, new web3.BigNumber('1178569e+18'));
      await this.token.transfer(testWallet2, new web3.BigNumber('1000000e+18'));
      await this.token.transfer(rewardWallet, testSupply);

      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18').mul(this.interestRate).div(36500).mul(this.vaultLockDays), { from: rewardWallet });

      await this.token.approve(this.vault.address, new web3.BigNumber('1178569e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('1178569e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('1000000e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('1000000e+18'), { from: testWallet2 });
    });

    it('should not be able to finalize before unlockTime', async function () {
      await this.vault.finalizeVault(true).should.be.rejected;
    });

    it('should be able to finalize after unlockTime', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault().should.be.fulfilled;
    });

    it('should not withdraw tokens if vault not finalized', async function () {
      await this.vault.withdrawToken({ from: testWallet1 }).should.be.rejected;
    });

    it('able to withdraw tokens if vault is finalized', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.withdrawToken({ from: testWallet1 }).should.be.fulfilled;
      await this.vault.withdrawToken({ from: testWallet2 }).should.be.fulfilled;
    });

    it('able to force withdraw tokens if vault is finalized', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.forceWithdrawToken(testWallet1, { from: adminWallet }).should.be.fulfilled;
      await this.vault.forceWithdrawToken(testWallet2, { from: adminWallet }).should.be.fulfilled;
    });

    it('unable to force withdraw tokens if not owner', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.forceWithdrawToken(testWallet1, { from: testWallet1 }).should.be.rejected;
      await this.vault.forceWithdrawToken(testWallet2, { from: testWallet2 }).should.be.rejected;
    });

    it('check withdraw amount scenario 1', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.withdrawToken({ from: testWallet1 });
      await this.vault.withdrawToken({ from: testWallet2 });
      let nextBalance1 = await this.token.balanceOf(testWallet1);
      nextBalance1.should.be.bignumber.equal(new web3.BigNumber('12076296054794520547945e+2'));
      let nextBalance2 = await this.token.balanceOf(testWallet2);
      nextBalance2.should.be.bignumber.equal(new web3.BigNumber('10246575342465753424657e+2'));
    });

    it('check withdraw amount scenario 2', async function () {
      await this.token.transfer(testWallet3, new web3.BigNumber('100e+18'));
      await this.token.approve(this.vault.address, new web3.BigNumber('100e+18'), { from: testWallet3 });
      await this.vault.lockToken(new web3.BigNumber('100e+18'), { from: testWallet3 });

      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.withdrawToken({ from: testWallet1 });
      await this.vault.withdrawToken({ from: testWallet2 });
      await this.vault.withdrawToken({ from: testWallet3 });
      let nextBalance1 = await this.token.balanceOf(testWallet1);
      nextBalance1.should.be.bignumber.equal(new web3.BigNumber('12076296054794520547945e+2'));
      let nextBalance2 = await this.token.balanceOf(testWallet2);
      nextBalance2.should.be.bignumber.equal(new web3.BigNumber('10246575342465753424657e+2'));
      let nextBalance3 = await this.token.balanceOf(testWallet3);
      nextBalance3.should.be.bignumber.equal(new web3.BigNumber('102465753424657534240'));
    });

    it('check withdraw amount scenario 3', async function () {
      await this.token.transfer(testWallet1, new web3.BigNumber('90000e+18'));
      await this.token.transfer(testWallet2, new web3.BigNumber('13421e+18'));
      await this.token.approve(this.vault.address, new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('13421e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('13421e+18'), { from: testWallet2 });

      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.withdrawToken({ from: testWallet1 });
      await this.vault.withdrawToken({ from: testWallet2 });
      let nextBalance1 = await this.token.balanceOf(testWallet1);
      nextBalance1.should.be.bignumber.equal(new web3.BigNumber('1.29984878356164383561638e+24'));
      let nextBalance2 = await this.token.balanceOf(testWallet2);
      nextBalance2.should.be.bignumber.equal(new web3.BigNumber('1.03840946301369863013696e+24'));
    });

    it('check withdraw amount scenario 4 - if not enough from finalize', async function () {
      await this.token.transfer(testWallet1, new web3.BigNumber('90000e+18'));
      await this.token.transfer(testWallet2, new web3.BigNumber('13421e+18'));
      await this.token.approve(this.vault.address, new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('13421e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('13421e+18'), { from: testWallet2 });

      await increaseTimeTo(this.unlockTime + 1);
      const totalTokens = await this.vault.tokensDeposited();
      await this.token.approve(this.vault.address, (totalTokens.mul(this.interestRate).div(36500).mul(this.vaultLockDays)).sub(100), { from: rewardWallet });
      await this.vault.finalizeVault().should.be.rejected;

      await this.token.approve(this.vault.address, (totalTokens.mul(this.interestRate).div(36500).mul(this.vaultLockDays)), { from: rewardWallet });
      await this.vault.finalizeVault().should.be.fulfilled;
    });

    it('withdrawing after withdraw fails', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.withdrawToken({ from: testWallet1 });
      await this.vault.withdrawToken({ from: testWallet2 });
      await this.vault.withdrawToken({ from: testWallet1 }).should.be.rejected;
      await this.vault.withdrawToken({ from: testWallet2 }).should.be.rejected;
    });
  });

  describe('withdrawing tokens flow with different rate', function () {
    beforeEach(async function () {
      this.depositTime = latestTime() + duration.weeks(1);
      this.unlockTime = this.depositTime + duration.days(60);
      this.interestRate = 9;
      this.vaultLockDays = 60;
      this.cap = new web3.BigNumber('50000000e+18');
      this.minDeposit = new web3.BigNumber('100e+18');

      this.token = await DemoRTEToken.new();
      this.vault = await RTELockingVault.new(this.token.address, this.cap, this.minDeposit, this.interestRate, this.depositTime, this.unlockTime, this.vaultLockDays, rewardWallet);
      // Transfer test tokens to testwallets
      await this.token.transfer(testWallet1, new web3.BigNumber('1178569e+18'));
      await this.token.transfer(testWallet2, new web3.BigNumber('1000000e+18'));
      await this.token.transfer(rewardWallet, testSupply);

      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18').mul(this.interestRate).div(36500).mul(this.vaultLockDays), { from: rewardWallet });

      await this.token.approve(this.vault.address, new web3.BigNumber('1178569e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('1178569e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('1000000e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('1000000e+18'), { from: testWallet2 });
    });

    it('check withdraw amount scenario 1', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.withdrawToken({ from: testWallet1 });
      await this.vault.withdrawToken({ from: testWallet2 });
      let nextBalance1 = await this.token.balanceOf(testWallet1);
      nextBalance1.should.be.bignumber.equal(new web3.BigNumber('1.1960053632876712328767e+24'));
      let nextBalance2 = await this.token.balanceOf(testWallet2);
      nextBalance2.should.be.bignumber.equal(new web3.BigNumber('1.01479452054794520547942e+24'));
    });

    it('check withdraw amount scenario 4 - if not enough from finalize', async function () {
      await this.token.transfer(testWallet1, new web3.BigNumber('90000e+18'));
      await this.token.transfer(testWallet2, new web3.BigNumber('13421e+18'));
      await this.token.approve(this.vault.address, new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('13421e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('13421e+18'), { from: testWallet2 });

      await increaseTimeTo(this.unlockTime + 1);
      const totalTokens = await this.vault.tokensDeposited();
      await this.token.approve(this.vault.address, (totalTokens.mul(this.interestRate).div(36500).mul(this.vaultLockDays)).sub(100), { from: rewardWallet });
      await this.vault.finalizeVault().should.be.rejected;

      await this.token.approve(this.vault.address, (totalTokens.mul(this.interestRate).div(36500).mul(this.vaultLockDays)), { from: rewardWallet });
      await this.vault.finalizeVault().should.be.fulfilled;
    });
  });

  describe('withdrawing tokens flow with different rate and locking period', function () {
    beforeEach(async function () {
      this.depositTime = latestTime() + duration.weeks(1);
      this.unlockTime = this.depositTime + duration.days(60);
      this.interestRate = 20;
      this.vaultLockDays = 360;
      this.cap = new web3.BigNumber('50000000e+18');
      this.minDeposit = new web3.BigNumber('100e+18');

      this.token = await DemoRTEToken.new();
      this.vault = await RTELockingVault.new(this.token.address, this.cap, this.minDeposit, this.interestRate, this.depositTime, this.unlockTime, this.vaultLockDays, rewardWallet);
      // Transfer test tokens to testwallets
      await this.token.transfer(testWallet1, new web3.BigNumber('1178569e+18'));
      await this.token.transfer(testWallet2, new web3.BigNumber('1000000e+18'));
      await this.token.transfer(rewardWallet, testSupply);

      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18').mul(this.interestRate).div(36500).mul(this.vaultLockDays), { from: rewardWallet });

      await this.token.approve(this.vault.address, new web3.BigNumber('1178569e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('1178569e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('1000000e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('1000000e+18'), { from: testWallet2 });
    });

    it('check withdraw amount scenario 1', async function () {
      await increaseTimeTo(this.unlockTime + 1);
      await this.vault.finalizeVault();
      await this.vault.withdrawToken({ from: testWallet1 });
      await this.vault.withdrawToken({ from: testWallet2 });
      let nextBalance1 = await this.token.balanceOf(testWallet1);
      nextBalance1.should.be.bignumber.equal(new web3.BigNumber('1.41105384383561643835612e+24'));
      let nextBalance2 = await this.token.balanceOf(testWallet2);
      nextBalance2.should.be.bignumber.equal(new web3.BigNumber('1.19726027397260273972584e+24'));
    });

    it('check withdraw amount scenario 4 - if not enough from finalize', async function () {
      await this.token.transfer(testWallet1, new web3.BigNumber('90000e+18'));
      await this.token.transfer(testWallet2, new web3.BigNumber('13421e+18'));
      await this.token.approve(this.vault.address, new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('90000e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('13421e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('13421e+18'), { from: testWallet2 });

      await increaseTimeTo(this.unlockTime + 1);
      const totalTokens = await this.vault.tokensDeposited();
      await this.token.approve(this.vault.address, (totalTokens.mul(this.interestRate).div(36500).mul(this.vaultLockDays)).sub(1000), { from: rewardWallet });
      await this.vault.finalizeVault().should.be.rejected;

      await this.token.approve(this.vault.address, (totalTokens.mul(this.interestRate).div(36500).mul(this.vaultLockDays)), { from: rewardWallet });
      await this.vault.finalizeVault().should.be.fulfilled;
    });
  });
});
