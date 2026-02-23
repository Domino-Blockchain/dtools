// This file shows how to mint new tokens and mint more of a prexisiting token
// 此文件展示了如何铸造新代币以及如何增发现有代币。

import {
  closeAccount,
  initializeAccount,
  initializeMint,
  memoInstruction,
  mintTo,
  TOKEN_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  signAndSendTransaction,
  transferChecked,
} from './instructions.js';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { ACCOUNT_LAYOUT, MINT_LAYOUT } from './data.js';


export async function createAndInitializeMint({
  connection,
  owner,
  mint,
  amount,
  decimals,
  initialAccount,
}) {
  let transaction = new Transaction();
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: owner.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(
        MINT_LAYOUT.span,
      ),
      space: MINT_LAYOUT.span,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  transaction.add(
    initializeMint({
      mint: mint.publicKey,
      decimals,
      mintAuthority: owner.publicKey,
    }),
  );
  let signers = [mint];
  if (amount > 0) {
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: owner.publicKey,
        newAccountPubkey: initialAccount.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(
          ACCOUNT_LAYOUT.span,
        ),
        space: ACCOUNT_LAYOUT.span,
        programId: TOKEN_PROGRAM_ID,
      }),
    );
    signers.push(initialAccount);
    transaction.add(
      initializeAccount({
        account: initialAccount.publicKey,
        mint: mint.publicKey,
        owner: owner.publicKey,
      }),
    );
    transaction.add(
      mintTo({
        mint: mint.publicKey,
        destination: initialAccount.publicKey,
        amount,
        mintAuthority: owner.publicKey,
      }),
    );
  }
  return await signAndSendTransaction(connection, transaction, owner, signers);
}

export async function mintMoreTokens({
  connection,
  mintAuthority, // Wallet with mint authority (pays fees and signs)
  mint, // PublicKey of the existing token mint
  destination, // PublicKey of the token account to receive the new tokens
  amount, // Number of tokens to mint (in smallest units, accounting for decimals)
}) {
  let transaction = new Transaction();
  
  transaction.add(
    mintTo({
      mint: mint,
      destination: destination,
      amount: amount,
      mintAuthority: mintAuthority.publicKey,
    }),
  );
  
  return await signAndSendTransaction(connection, transaction, mintAuthority, []);
}

export async function mintMoreTokensWithNewAccount({
  connection,
  mintAuthority, // Wallet with mint authority
  mint, // PublicKey of the existing token mint
  destinationOwner, // PublicKey of who will own the new token account
  amount, // Number of tokens to mint (as BigInt)
}) {
  const newTokenAccount = Keypair.generate();
  let transaction = new Transaction();
  
  // Create the token account
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: mintAuthority.publicKey,
      newAccountPubkey: newTokenAccount.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(ACCOUNT_LAYOUT.span),
      space: ACCOUNT_LAYOUT.span,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  
  // Initialize it
  transaction.add(
    initializeAccount({
      account: newTokenAccount.publicKey,
      mint: mint,
      owner: destinationOwner,
    }),
  );
  
  // Mint tokens to it
  transaction.add(
    mintTo({
      mint: mint,
      destination: newTokenAccount.publicKey,
      amount: BigInt(amount), // Ensure it's a BigInt for the u64 encoding
      mintAuthority: mintAuthority.publicKey,
    }),
  );
  
  return await signAndSendTransaction(connection, transaction, mintAuthority, [newTokenAccount]);
}