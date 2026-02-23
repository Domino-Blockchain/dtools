import { Transaction } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  signAndSendTransaction, 
  burn, 
  closeAccount 
} from './instructions.js';
import { parseTokenAccountData } from './data.js';

/**
 * Burn tokens from a token account
 * @param {Object} params
 * @param {Connection} params.connection
 * @param {Wallet} params.owner - Wallet that owns the token account
 * @param {PublicKey} params.tokenAccount - Token account to burn from
 * @param {PublicKey} params.mint - Mint of the token
 * @param {BigInt|number} params.amount - Amount to burn (in smallest units)
 * @returns {Promise<string>} Transaction signature
 */
export async function burnTokens({
  connection,
  owner,
  tokenAccount,
  mint,
  amount,
}) {
  let transaction = new Transaction();
  
  transaction.add(
    burn({
      account: tokenAccount,
      mint: mint,
      amount: BigInt(amount),
      owner: owner.publicKey,
    }),
  );
  
  return await signAndSendTransaction(connection, transaction, owner, []);
}

/**
 * Burn tokens and close the account if empty
 * @param {Object} params
 * @param {Connection} params.connection
 * @param {Wallet} params.owner - Wallet that owns the token account
 * @param {PublicKey} params.tokenAccount - Token account to burn from
 * @param {PublicKey} params.mint - Mint of the token
 * @param {BigInt|number} params.amount - Amount to burn (in smallest units)
 * @param {boolean} params.closeIfEmpty - Close account after burning if balance becomes zero
 * @returns {Promise<string>} Transaction signature
 */
export async function burnTokensAndClose({
  connection,
  owner,
  tokenAccount,
  mint,
  amount,
  closeIfEmpty = false,
}) {
  let transaction = new Transaction();
  
  transaction.add(
    burn({
      account: tokenAccount,
      mint: mint,
      amount: BigInt(amount),
      owner: owner.publicKey,
    }),
  );
  
  if (closeIfEmpty) {
    transaction.add(
      closeAccount({
        source: tokenAccount,
        destination: owner.publicKey,
        owner: owner.publicKey,
      }),
    );
  }
  
  return await signAndSendTransaction(connection, transaction, owner, []);
}

/**
 * Burn all tokens from a token account
 * @param {Object} params
 * @param {Connection} params.connection
 * @param {Wallet} params.owner - Wallet that owns the token account
 * @param {PublicKey} params.tokenAccount - Token account to burn from
 * @param {PublicKey} params.mint - Mint of the token
 * @param {boolean} params.closeAccount - Close account after burning
 * @returns {Promise<string>} Transaction signature
 */
export async function burnAllTokens({
  connection,
  owner,
  tokenAccount,
  mint,
  closeAccount: shouldClose = false,
}) {
  // Get current balance
  const accountInfo = await connection.getAccountInfo(tokenAccount);
  if (!accountInfo) {
    throw new Error('Token account not found');
  }
  
  const tokenData = parseTokenAccountData(accountInfo.data);
  const amount = tokenData.amount;
  
  if (amount === BigInt(0)) {
    throw new Error('Token account has zero balance');
  }
  
  return await burnTokensAndClose({
    connection,
    owner,
    tokenAccount,
    mint,
    amount,
    closeIfEmpty: shouldClose,
  });
}

// USAGE EXAMPLES
/*
// Burn specific amount
const txSig = await burnTokens({
  connection,
  owner: wallet,
  tokenAccount: myTokenAccountPublicKey,
  mint: mintPublicKey,
  amount: BigInt(1000000), // Amount in smallest units
});
console.log(`Burned tokens, tx: ${txSig}`);

// Burn and close account to reclaim rent
const txSig2 = await burnTokensAndClose({
  connection,
  owner: wallet,
  tokenAccount: myTokenAccountPublicKey,
  mint: mintPublicKey,
  amount: BigInt(1000000),
  closeIfEmpty: true,
});
console.log(`Burned and closed, tx: ${txSig2}`);

// Burn all tokens in an account
const txSig3 = await burnAllTokens({
  connection,
  owner: wallet,
  tokenAccount: myTokenAccountPublicKey,
  mint: mintPublicKey,
  closeAccount: true,
});
console.log(`Burned all tokens, tx: ${txSig3}`);
*/