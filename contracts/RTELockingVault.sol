pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/ownership/CanReclaimToken.sol";
import "openzeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title RTELockingVault
 * @dev For RTE token holders to lock up their tokens for incentives
 */
contract RTELockingVault is HasNoEther, CanReclaimToken {
  using SafeERC20 for ERC20;
  using SafeMath for uint256;

  ERC20 public token;

  bool public vaultUnlocked;

  uint256 public cap;

  uint256 public minimumDeposit;

  uint256 public tokensDeposited;

  uint256 public interestRate;

  uint256 public vaultDepositDeadlineTime;

  uint256 public vaultUnlockTime;

  uint256 public vaultLockDays;

  address public rewardWallet;

  mapping(address => uint256) public lockedBalances;

  /**
   * @dev Locked tokens event
   * @param _investor Investor address
   * @param _value Tokens locked
   */
  event TokenLocked(address _investor, uint256 _value);

  /**
   * @dev Withdrawal event
   * @param _investor Investor address
   * @param _value Tokens withdrawn
   */
  event TokenWithdrawal(address _investor, uint256 _value);

  constructor (
    ERC20 _token,
    uint256 _cap,
    uint256 _minimumDeposit,
    uint256 _interestRate,
    uint256 _vaultDepositDeadlineTime,
    uint256 _vaultUnlockTime,
    uint256 _vaultLockDays,
    address _rewardWallet
  )
    public
  {
    require(_vaultDepositDeadlineTime > now);
    require(_vaultDepositDeadlineTime < _vaultUnlockTime);

    vaultUnlocked = false;

    token = _token;
    cap = _cap;
    minimumDeposit = _minimumDeposit;
    interestRate = _interestRate;
    vaultDepositDeadlineTime = _vaultDepositDeadlineTime;
    vaultUnlockTime = _vaultUnlockTime;
    vaultLockDays = _vaultLockDays;
    rewardWallet = _rewardWallet;
  }

  /**
   * @dev Deposit and lock tokens
   * @param _amount Amount of tokens to transfer and lock
   */
  function lockToken(uint256 _amount) public {
    require(_amount >= minimumDeposit);
    require(now < vaultDepositDeadlineTime);
    require(tokensDeposited.add(_amount) <= cap);

    token.safeTransferFrom(msg.sender, address(this), _amount);

    lockedBalances[msg.sender] = lockedBalances[msg.sender].add(_amount);

    tokensDeposited = tokensDeposited.add(_amount);

    emit TokenLocked(msg.sender, _amount);
  }

  /**
   * @dev Withdraw locked tokens
   */
  function withdrawToken() public {
    require(vaultUnlocked);

    uint256 interestAmount = (interestRate.mul(lockedBalances[msg.sender]).div(36500)).mul(vaultLockDays);

    uint256 withdrawAmount = (lockedBalances[msg.sender]).add(interestAmount);
    require(withdrawAmount > 0);

    lockedBalances[msg.sender] = 0;

    token.safeTransfer(msg.sender, withdrawAmount);

    emit TokenWithdrawal(msg.sender, withdrawAmount);
  }

  /**
   * @dev Force Withdraw locked tokens
   */
  function forceWithdrawToken(address _forceAddress) public onlyOwner {
    require(vaultUnlocked);

    uint256 interestAmount = (interestRate.mul(lockedBalances[_forceAddress]).div(36500)).mul(vaultLockDays);

    uint256 withdrawAmount = (lockedBalances[_forceAddress]).add(interestAmount);
    require(withdrawAmount > 0);

    lockedBalances[_forceAddress] = 0;

    token.safeTransfer(_forceAddress, withdrawAmount);

    emit TokenWithdrawal(_forceAddress, withdrawAmount);
  }

  /**
   * @dev Irreversibly finalizes and unlocks the vault - only owner of contract can call this
   */
  function finalizeVault() public onlyOwner {
    require(!vaultUnlocked);
    require(now >= vaultUnlockTime);

    vaultUnlocked = true;

    uint256 bonusTokens = ((tokensDeposited.mul(interestRate)).div(36500)).mul(vaultLockDays);

    token.safeTransferFrom(rewardWallet, address(this), bonusTokens);
  }
}
