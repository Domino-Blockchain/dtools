# Domichain Token Toolkit

A JavaScript/TypeScript toolkit for interacting with tokens on the Domi blockchain. This library provides simple, developer-friendly functions for common token operations including minting, burning, transferring, and balance queries.

一个用于与 Domi 区块链上的代币进行交互的 JavaScript/TypeScript 工具包。该库提供了简洁易用的开发者友好型函数，用于执行常见的代币操作，包括铸币、销毁、转移和余额查询。

## Warning

Do not use keypairs provided in this project in production. Assume they are compromised. Their only purpose is for testing in this environment and should not be used elsewhere.

## Installation

```bash
npm install @solana/web3.js @solana/buffer-layout buffer-layout bigint-buffer
```

## Package Versions

```json
{
  "@solana/spl-token-registry": "^0.2.102",
  "@solana/web3.js": "^1.17.0"
}
```

## Files Overview

- **instructions.js** - Core token instruction builders and constants
- **data.js** - Data layouts and parsing utilities
- **mint.js** - Token creation and minting functions
- **burn.js** - Token burning functions
- **balance.js** - Balance query functions
- **transfer.js** - Token transfer and account management functions

- **instructions.js** - 核心代币指令构建器和常量

- **data.js** - 数据布局和解析工具

- **mint.js** - 代币创建和铸造函数

- **burn.js** - 代币销毁函数

- **balance.js** - 余额查询函数

- **transfer.js** - 代币转账和账户管理函数

---

## Quick Start

```javascript
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('https://api.testnet.domichain.io', 'confirmed');
const wallet = Keypair.fromSecretKey(/* your secret key 你的秘密钥匙 */);
```

---

## Minting Tokens

### Create a New Token with Metadata

```javascript
import { createAndInitializeMint } from './mint';
import { Keypair } from '@solana/web3.js';

const mint = Keypair.generate();
const initialAccount = Keypair.generate();

const txSig = await createAndInitializeMint({
  connection,
  owner: wallet,
  mint,
  name: 'My Token',
  symbol: 'MTK',
  amount: BigInt(1000000000), // Initial supply 初始供应量
  decimals: 9,
  initialAccount,
  uri: 'https://arweave.net/your-metadata-uri'
});

console.log(`Token created: ${mint.publicKey.toBase58()}`);
console.log(`Transaction: ${txSig}`);
```

### Mint More Tokens (Existing Token)

```javascript
import { mintMoreTokens } from './mint';

const txSig = await mintMoreTokens({
  connection,
  mintAuthority: wallet,
  mint: mintPublicKey,
  destination: tokenAccountPublicKey,
  amount: BigInt(500000000)
});

console.log(`Minted additional tokens: ${txSig}`);
```

### Mint Tokens to New Account

```javascript
import { mintMoreTokensWithNewAccount } from './mint';

const txSig = await mintMoreTokensWithNewAccount({
  connection,
  mintAuthority: wallet,
  mint: mintPublicKey,
  destinationOwner: recipientWalletPublicKey,
  amount: BigInt(1000000000)
});

console.log(`Minted to new account: ${txSig}`);
```

---

## Burning Tokens

### Burn Specific Amount

```javascript
import { burnTokens } from './burn';

const txSig = await burnTokens({
  connection,
  owner: wallet,
  tokenAccount: myTokenAccountPublicKey,
  mint: mintPublicKey,
  amount: BigInt(1000000)
});

console.log(`Burned tokens: ${txSig}`);
```

### Burn and Close Account

```javascript
import { burnTokensAndClose } from './burn';

const txSig = await burnTokensAndClose({
  connection,
  owner: wallet,
  tokenAccount: myTokenAccountPublicKey,
  mint: mintPublicKey,
  amount: BigInt(1000000),
  closeIfEmpty: true // Reclaim rent
});

console.log(`Burned and closed account: ${txSig}`);
```

### Burn All Tokens

```javascript
import { burnAllTokens } from './burn';

const txSig = await burnAllTokens({
  connection,
  owner: wallet,
  tokenAccount: myTokenAccountPublicKey,
  mint: mintPublicKey,
  closeAccount: true
});

console.log(`Burned all tokens: ${txSig}`);
```

---

## Balance Queries

### Get Native DOMI Balance

```javascript
import { getNativeBalance, getNativeBalanceInDomi } from './balance';

// In lamports
const lamports = await getNativeBalance(connection, walletPublicKey);
console.log(`Balance: ${lamports} lamports`);

// In DOMI
const domi = await getNativeBalanceInDomi(connection, walletPublicKey);
console.log(`Balance: ${domi / 1e9} DOMI`);
```

### Get Token Account Balance

```javascript
import { getTokenAccountBalance } from './balance';

const balance = await getTokenAccountBalance(connection, tokenAccountPublicKey);
console.log(`Amount: ${balance.amount}`);
console.log(`Decimals: ${balance.decimals}`);
console.log(`UI Amount: ${balance.uiAmount}`);
console.log(`Mint: ${balance.mint.toBase58()}`);
```

### Get All Token Balances for Wallet

```javascript
import { getAllTokenBalances } from './balance';

const balances = await getAllTokenBalances(connection, walletPublicKey);

for (const balance of balances) {
  console.log(`Token: ${balance.mint.toBase58()}`);
  console.log(`  Account: ${balance.publicKey.toBase58()}`);
  console.log(`  Balance: ${balance.uiAmount}`);
  console.log(`  Decimals: ${balance.decimals}`);
}
```

### Get Associated Token Account Balance

```javascript
import { getAssociatedTokenBalance } from './balance';

const balance = await getAssociatedTokenBalance(
  connection,
  walletPublicKey,
  mintPublicKey
);

if (balance) {
  console.log(`ATA: ${balance.tokenAccount.toBase58()}`);
  console.log(`Balance: ${balance.uiAmount}`);
} else {
  console.log('No associated token account exists');
}
```

### Get Mint Supply Info

```javascript
import { getMintSupply } from './balance';

const supplyInfo = await getMintSupply(connection, mintPublicKey);
console.log(`Total Supply: ${supplyInfo.uiSupply}`);
console.log(`Decimals: ${supplyInfo.decimals}`);
console.log(`Mint Authority: ${supplyInfo.mintAuthority?.toBase58()}`);
console.log(`Freeze Authority: ${supplyInfo.freezeAuthority?.toBase58()}`);
```

---

## Transfers

### Transfer Native DOMI

```javascript
import { nativeTransfer } from './transfer';

const txSig = await nativeTransfer(
  connection,
  wallet,
  destinationPublicKey,
  1000000000 // 1 DOMI in lamports
);

console.log(`Transferred DOMI: ${txSig}`);
```

### Transfer Tokens

```javascript
import { transferTokens } from './transfer';

const txSig = await transferTokens({
  connection,
  owner: wallet,
  sourcePublicKey: myTokenAccountPublicKey,
  destinationPublicKey: recipientPublicKey,
  amount: BigInt(1000000),
  memo: 'Payment for services',
  mint: mintPublicKey,
  decimals: 9,
  overrideDestinationCheck: false
});

console.log(`Transferred tokens: ${txSig}`);
```

### Create Token Account

```javascript
import { createAndInitializeTokenAccount } from './transfer';
import { Keypair } from '@solana/web3.js';

const newAccount = Keypair.generate();

const txSig = await createAndInitializeTokenAccount({
  connection,
  payer: wallet,
  mintPublicKey: mintPublicKey,
  newAccount
});

console.log(`Created token account: ${newAccount.publicKey.toBase58()}`);
```

### Create Associated Token Account

```javascript
import { createAssociatedTokenAccount } from './transfer';

const [ataAddress, txSig] = await createAssociatedTokenAccount({
  connection,
  wallet,
  dplTokenMintAddress: mintPublicKey
});

console.log(`ATA Address: ${ataAddress.toBase58()}`);
console.log(`Transaction: ${txSig}`);
```

### Find Associated Token Address

```javascript
import { findAssociatedTokenAddress } from './transfer';

const ataAddress = findAssociatedTokenAddress(
  walletPublicKey,
  mintPublicKey
);

console.log(`ATA: ${ataAddress.toBase58()}`);
```

### Close Token Account

```javascript
import { closeTokenAccount } from './transfer';

const txSig = await closeTokenAccount({
  connection,
  owner: wallet,
  sourcePublicKey: emptyTokenAccountPublicKey,
  skipPreflight: false
});

console.log(`Closed account, reclaimed rent: ${txSig}`);
```

---

## Constants

```javascript
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  BTCI_PROGRAM_ID,
  USDT_PROGRAM_ID,
  WRAPPED_DOMI_MINT,
  MEMO_PROGRAM_ID
} from './instructions';
```

---

## Data Parsing Utilities

```javascript
import {
  parseTokenAccountData,
  parseMintData,
  getOwnedAccountsFilters,
  ACCOUNT_LAYOUT,
  MINT_LAYOUT
} from './data';

// Parse raw account data
const tokenData = parseTokenAccountData(accountInfo.data);
console.log(`Mint: ${tokenData.mint.toBase58()}`);
console.log(`Owner: ${tokenData.owner.toBase58()}`);
console.log(`Amount: ${tokenData.amount}`);

// Parse mint data
const mintData = parseMintData(mintAccountInfo.data);
console.log(`Decimals: ${mintData.decimals}`);
```

---

## Important Notes

1. **BigInt Usage**: Token amounts use BigInt for precision. Always wrap amounts with `BigInt()` when calling functions.

2. **Decimals**: Token amounts are in the smallest unit. For a token with 9 decimals, 1 token = 1,000,000,000 smallest units.

3. **Wallet Interface**: The `wallet` parameter expects an object with:
   - `publicKey`: PublicKey
   - `signTransaction(tx)`: Function that returns signed transaction

4. **Authority Requirements**:
   - Minting requires mint authority
   - Burning requires token account ownership
   - Transfers require source account ownership

5. **Rent Exemption**: Creating accounts requires lamports for rent exemption. This is automatically calculated.

6. **Associated Token Accounts (ATA)**: Deterministic addresses derived from wallet + mint. Preferred over random token accounts.

## 重要提示

1. **BigInt 用法**：代币数量使用 BigInt 以确保精度。调用函数时，请始终使用 `BigInt()` 函数包裹数量。

2. **小数位数**：代币数量以最小单位表示。对于小数位数为 9 的代币，1 个代币 = 1,000,000,000 个最小单位。

3. **钱包接口**：`wallet` 参数需要一个包含以下内容的对象：

- `publicKey`：公钥

- `signTransaction(tx)`：返回已签名交易的函数

4. **权限要求**：

- 铸币需要铸币权限

- 销毁需要代币账户所有权

- 转账需要源账户所有权

5. **租金豁免**：创建账户需要导入才能享受租金豁免。此豁免金额会自动计算。

6. **关联代币账户 (ATA)**：由钱包地址和铸币地址生成的确定性地址。优于随机代币账户。
---

## Error Handling

```javascript
try {
  const txSig = await mintMoreTokens({
    connection,
    mintAuthority: wallet,
    mint: mintPublicKey,
    destination: tokenAccountPublicKey,
    amount: BigInt(1000000)
  });
  console.log(`Success: ${txSig}`);
} catch (error) {
  if (error.message.includes('Token account not found')) {
    console.error('The destination token account does not exist');
  } else if (error.message.includes('insufficient funds')) {
    console.error('Wallet has insufficient DOMI for fees');
  } else {
    console.error('Transaction failed:', error);
  }
}
```

---

## License

MIT
