import { PublicKey } from '@solana/web3.js';
import { ACCOUNT_LAYOUT, MINT_LAYOUT, parseTokenAccountData, parseMintData } from './data.js';
import { TOKEN_PROGRAM_ID } from './instructions.js';

/**
 * Get native DOMI balance for a wallet
 * @param {Connection} connection
 * @param {PublicKey} publicKey
 * @returns {Promise<number>} Balance in lamports
 */
export async function getNativeBalance(connection, publicKey) {
  const balance = await connection.getBalance(publicKey);
  return balance;
}

/**
 * Get native DOMI balance formatted in DOMI (not lamports)
 * @param {Connection} connection
 * @param {PublicKey} publicKey
 * @returns {Promise<number>} Balance in DOMI
 */
export async function getNativeBalanceInDomi(connection, publicKey) {
  const lamports = await connection.getBalance(publicKey);
  return lamports
}

/**
 * Get token balance for a specific token account
 * @param {Connection} connection
 * @param {PublicKey} tokenAccountPublicKey
 * @returns {Promise<{amount: BigInt, decimals: number, uiAmount: number}>}
 */
export async function getTokenAccountBalance(connection, tokenAccountPublicKey) {
  const accountInfo = await connection.getAccountInfo(tokenAccountPublicKey);
  
  if (!accountInfo) {
    throw new Error('Token account not found');
  }
  
  const tokenData = parseTokenAccountData(accountInfo.data);
  const mintInfo = await connection.getAccountInfo(tokenData.mint);
  const mintData = parseMintData(mintInfo.data);
  
  const amount = tokenData.amount;
  const decimals = mintData.decimals;
  const uiAmount = Number(amount) / Math.pow(10, decimals);
  
  return {
    amount,
    decimals,
    uiAmount,
    mint: tokenData.mint,
  };
}

/**
 * Get all token balances for a wallet
 * @param {Connection} connection
 * @param {PublicKey} walletPublicKey
 * @returns {Promise<Array<{publicKey: PublicKey, mint: PublicKey, amount: BigInt, decimals: number, uiAmount: number}>>}
 */
export async function getAllTokenBalances(connection, walletPublicKey) {
  const tokenAccounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: ACCOUNT_LAYOUT.span },
      {
        memcmp: {
          offset: 32, // Owner offset in token account
          bytes: walletPublicKey.toBase58(),
        },
      },
    ],
  });
  
  const balances = [];
  
  for (const { pubkey, account } of tokenAccounts) {
    const tokenData = parseTokenAccountData(account.data);
    
    // Skip if balance is zero
    if (tokenData.amount === BigInt(0)) {
      continue;
    }
    
    const mintInfo = await connection.getAccountInfo(tokenData.mint);
    const mintData = parseMintData(mintInfo.data);
    
    balances.push({
      publicKey: pubkey,
      mint: tokenData.mint,
      amount: tokenData.amount,
      decimals: mintData.decimals,
      uiAmount: Number(tokenData.amount) / Math.pow(10, mintData.decimals),
    });
  }
  
  return balances;
}

/**
 * Get token balance using Associated Token Account
 * @param {Connection} connection
 * @param {PublicKey} walletPublicKey
 * @param {PublicKey} mintPublicKey
 * @returns {Promise<{amount: BigInt, decimals: number, uiAmount: number} | null>}
 */
export async function getAssociatedTokenBalance(connection, walletPublicKey, mintPublicKey) {
  const associatedTokenAddress = PublicKey.findProgramAddressSync(
    [
      walletPublicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    new PublicKey('Dt8fRCpjeV6JDemhPmtcTKijgKdPxXHn9Wo9cXY5agtG'), // ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
  
  const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
  
  if (!accountInfo) {
    return null; // No associated token account exists
  }
  
  const tokenData = parseTokenAccountData(accountInfo.data);
  const mintInfo = await connection.getAccountInfo(mintPublicKey);
  const mintData = parseMintData(mintInfo.data);
  
  return {
    tokenAccount: associatedTokenAddress,
    amount: tokenData.amount,
    decimals: mintData.decimals,
    uiAmount: Number(tokenData.amount) / Math.pow(10, mintData.decimals),
  };
}

/**
 * Get mint supply information
 * @param {Connection} connection
 * @param {PublicKey} mintPublicKey
 * @returns {Promise<{supply: BigInt, decimals: number, uiSupply: number}>}
 */
export async function getMintSupply(connection, mintPublicKey) {
  const mintInfo = await connection.getAccountInfo(mintPublicKey);
  
  if (!mintInfo) {
    throw new Error('Mint not found');
  }
  
  const mintData = parseMintData(mintInfo.data);
  
  return {
    supply: mintData.supply,
    decimals: mintData.decimals,
    uiSupply: Number(mintData.supply) / Math.pow(10, mintData.decimals),
    mintAuthority: mintData.mintAuthority,
    freezeAuthority: mintData.freezeAuthority,
  };
}

// USAGE EXAMPLES:
/*
// Get native balance
const nativeBalance = await getNativeBalance(connection, walletPublicKey);
console.log(`Native balance: ${nativeBalance} lamports`);
console.log(`Native balance: ${nativeBalance / 1e9} DOMI`);

// Get specific token account balance
const tokenBalance = await getTokenAccountBalance(connection, tokenAccountPublicKey);
console.log(`Token balance: ${tokenBalance.uiAmount}`);

// Get all token balances for a wallet
const allBalances = await getAllTokenBalances(connection, walletPublicKey);
for (const balance of allBalances) {
  console.log(`Mint: ${balance.mint.toBase58()}, Balance: ${balance.uiAmount}`);
}

// Get associated token balance for a specific mint
const ataBalance = await getAssociatedTokenBalance(connection, walletPublicKey, mintPublicKey);
if (ataBalance) {
  console.log(`ATA Balance: ${ataBalance.uiAmount}`);
} else {
  console.log('No associated token account found');
}

// Get mint supply info
const supplyInfo = await getMintSupply(connection, mintPublicKey);
console.log(`Total supply: ${supplyInfo.uiSupply}`);
*/