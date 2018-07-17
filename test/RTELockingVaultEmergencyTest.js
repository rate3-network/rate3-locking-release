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
contract('RTELockingVault Emergency Test', function (accounts) {
  // Contract init parameters
  const testSupply = new web3.BigNumber('100000000e+18');

  // Testnet account labelling
  const adminWallet = accounts[0];
  const rewardWallet = accounts[2];
  const testWallet1 = accounts[8];
  const testWallet2 = accounts[9];

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  describe('emergency drain flow', function () {
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
      await this.token.transfer(testWallet2, testSupply);
      await this.token.transfer(rewardWallet, testSupply);

      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18').mul(this.interestRate).div(36500).mul(this.vaultLockDays), { from: rewardWallet });

      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18'), { from: testWallet1 });
      await this.vault.lockToken(new web3.BigNumber('1000000e+18'), { from: testWallet1 });
      await this.token.approve(this.vault.address, new web3.BigNumber('50000000e+18'), { from: testWallet2 });
      await this.vault.lockToken(new web3.BigNumber('1000000e+18'), { from: testWallet2 });
    });

    it('regular users should not be able to drain vault', async function () {
      await this.vault.reclaimToken(this.token.address, { from: testWallet1 }).should.be.rejected;
      await this.vault.reclaimToken(this.token.address, { from: testWallet2 }).should.be.rejected;
    });

    it('owner should be able to drain vault', async function () {
      await this.vault.reclaimToken(this.token.address, { from: adminWallet }).should.be.fulfilled;
    });
  });
});
