pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

/**
 * @title DemoRTEToken
 * @dev ERC20 token implementation
 * Pausable
 */
contract DemoRTEToken is StandardToken {
  string public constant name = "Rate3";
  string public constant symbol = "RTE";
  uint8 public constant decimals = 18;

  // 1 billion initial supply of RTE tokens
  // Taking into account 18 decimals
  uint256 public constant INITIAL_SUPPLY = (10 ** 9) * (10 ** 18);

  /**
   * @dev RTEToken Constructor
   * Mints the initial supply of tokens, this is the hard cap, no more tokens will be minted.
   * Allocate the tokens to the foundation wallet, issuing wallet etc.
   */
  function DemoRTEToken() public {
    // Mint initial supply of tokens. All further minting of tokens is disabled
    totalSupply_ = INITIAL_SUPPLY;

    // Transfer all initial tokens to msg.sender
    balances[msg.sender] = INITIAL_SUPPLY;
    emit Transfer(0x0, msg.sender, INITIAL_SUPPLY);
  }
}
