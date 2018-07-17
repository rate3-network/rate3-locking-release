# rate3-locking
Vault to lock up RTE tokens

## Test Deployment
```
npm install -g ganache-cli
npm install
truffle compile
ganache-cli -e 100000
truffle migrate
```

## Vault FAQ
#### When can I deposit my RTE tokens?
You can deposit RTE tokens at any time before the vault deadline if the vault has not yet reached its RTE token cap.

#### Do I need a Metamask account to deposit RTE?
You will need a Metamask account to be able to interact with the vault through our web portal. However, you can choose to deposit tokens manually through the smart contract if you wish.

#### How long will my RTE tokens will be locked for, and how much reward will I receive?
The RTE reward and locking period will be clearly defined on the smart contract, and will be shown on the web portal.

#### How do I withdraw my RTE tokens after the vault locking period?
There will be a withdrawal function on the web portal once the locking period is over.

#### Help! I accidentally locked my RTE tokens, can I claim them back before the locking period ends?
No, locked tokens are not claimable until the vault locking period is over. 