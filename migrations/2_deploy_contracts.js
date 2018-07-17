const RTELockingVault = artifacts.require("./RTELockingVault.sol");

// These are temporary values
module.exports = function(deployer, network, accounts) {
  const RTETokenAddress = '0x436F0F3a982074c4a05084485D421466a994FE53';
  const rewardWalletAddress = '0x745381F29Dcaa144142B2048D7555Ddd1205b784';
  const depositDeadlineTime = 1532001600;
  const vaultUnlockTime = 1532001600 + (360 * 86400);
  const cap = new web3.BigNumber('1000000e+18');
  const minDeposit = new web3.BigNumber('100e+18');
  const annualInterest = 20;
  const vaultLockDays = 360;
  deployer.deploy(RTELockingVault, RTETokenAddress, cap, minDeposit, annualInterest, depositDeadlineTime, vaultUnlockTime, vaultLockDays, rewardWalletAddress);
};