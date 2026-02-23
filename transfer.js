// This file shows how to transfer Domi, Domi Tokens, and other Token Account functions
// 此文件展示了如何转移 Domi、Domi Token 和其他 Token Account 功能

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { ACCOUNT_LAYOUT, getOwnedAccountsFilters, MINT_LAYOUT } from './data.js';
import {
  closeAccount,
  initializeAccount,
  memoInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  transferChecked,
  signAndSendTransaction,
} from './instructions.js';

export async function nativeTransfer(connection, wallet, destination, amount) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: destination,
      lamports: amount,
    }),
  );
  return await signAndSendTransaction(connection, tx, wallet, []);
}

export async function transferTokens({
  connection,
  owner,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
  mint,
  decimals,
  overrideDestinationCheck,
  programId = TOKEN_PROGRAM_ID,
}) {
  let destinationAccountInfo = await connection.getAccountInfo(
    destinationPublicKey,
  );
  if (
    !!destinationAccountInfo &&
    destinationAccountInfo.owner.equals(programId)
  ) {
    return await transferBetweenSplTokenAccounts({
      connection,
      owner,
      mint,
      decimals,
      sourcePublicKey,
      destinationPublicKey,
      amount,
      memo,
      programId,
    });
  }

  if (
    (!destinationAccountInfo || destinationAccountInfo.lamports === 0) &&
    !overrideDestinationCheck
  ) {
    throw new Error('Cannot send to address with zero DOMI balances');
  }

  const destinationAssociatedTokenAddress = findAssociatedTokenAddress(
    destinationPublicKey,
    mint,
    programId,
  );
  destinationAccountInfo = await connection.getAccountInfo(
    destinationAssociatedTokenAddress,
  );
  if (
    !!destinationAccountInfo &&
    destinationAccountInfo.owner.equals(programId)
  ) {
    return await transferBetweenSplTokenAccounts({
      connection,
      owner,
      mint,
      decimals,
      sourcePublicKey,
      destinationPublicKey: destinationAssociatedTokenAddress,
      amount,
      memo,
      programId,
    });
  }
  return await createAndTransferToAccount({
    connection,
    owner,
    sourcePublicKey,
    destinationPublicKey,
    amount,
    memo,
    mint,
    decimals,
    programId,
  });
}

export async function createAndInitializeTokenAccount({
  connection,
  payer,
  mintPublicKey,
  newAccount,
}) {
  let transaction = new Transaction();
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: newAccount.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(
        ACCOUNT_LAYOUT.span,
      ),
      space: ACCOUNT_LAYOUT.span,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  transaction.add(
    initializeAccount({
      account: newAccount.publicKey,
      mint: mintPublicKey,
      owner: payer.publicKey,
    }),
  );

  let signers = [newAccount];
  return await signAndSendTransaction(connection, transaction, payer, signers);
}

export async function createAssociatedTokenAccount({
  connection,
  wallet,
  dplTokenMintAddress,
}) {
  const [ix, address] = await createAssociatedTokenAccountIx(
    wallet.publicKey,
    wallet.publicKey,
    dplTokenMintAddress,
  );
  const tx = new Transaction();
  tx.add(ix);
  tx.feePayer = wallet.publicKey;
  const txSig = await signAndSendTransaction(connection, tx, wallet, []);

  return [address, txSig];
}

async function createAssociatedTokenAccountIx(
  fundingAddress,
  walletAddress,
  dplTokenMintAddress,
  programId,
) {
  const associatedTokenAddress = findAssociatedTokenAddress(
    walletAddress,
    dplTokenMintAddress,
    programId,
  );
  const keys = [
    {
      pubkey: fundingAddress,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: dplTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  const ix = new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
  return [ix, associatedTokenAddress];
}

export function findAssociatedTokenAddress(
  walletAddress,
  tokenMintAddress,
  programId = TOKEN_PROGRAM_ID,
) {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      programId.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

async function createAndTransferToAccount({
  connection,
  owner,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
  mint,
  decimals,
  programId,
}) {
  const [createAccountInstruction, newAddress] =
    await createAssociatedTokenAccountIx(
      owner.publicKey,
      destinationPublicKey,
      mint,
      programId,
    );
  const transaction = new Transaction().add(
    createAccountInstruction,
    createTransferBetweenSplTokenAccountsInstruction({
      ownerPublicKey: owner.publicKey,
      mint,
      decimals,
      sourcePublicKey,
      destinationPublicKey: newAddress,
      amount,
      memo,
      programId,
    }),
  );
  // transaction.add(
  //   assertOwner({
  //     account: destinationPublicKey,
  //     owner: SystemProgram.programId,
  //   }),
  // );
  return transaction;
}

function createTransferBetweenSplTokenAccountsInstruction({
  ownerPublicKey,
  mint,
  decimals,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
  programId,
}) {
  let transaction = new Transaction().add(
    transferChecked({
      source: sourcePublicKey,
      mint,
      decimals,
      destination: destinationPublicKey,
      owner: ownerPublicKey,
      amount,
      programId,
    }),
  );
  if (memo) {
    transaction.add(memoInstruction(memo));
  }
  return transaction;
}

async function transferBetweenSplTokenAccounts({
  connection,
  owner,
  mint,
  decimals,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
  programId,
}) {
  const transaction = createTransferBetweenSplTokenAccountsInstruction({
    ownerPublicKey: owner.publicKey,
    mint,
    decimals,
    sourcePublicKey,
    destinationPublicKey,
    amount,
    memo,
    programId,
  });
  return transaction;
}

export async function closeTokenAccount({
  connection,
  owner,
  sourcePublicKey,
  skipPreflight,
}) {
  let transaction = new Transaction().add(
    closeAccount({
      source: sourcePublicKey,
      destination: owner.publicKey,
      owner: owner.publicKey,
    }),
  );
  let signers = [];
  return await signAndSendTransaction(
    connection,
    transaction,
    owner,
    signers,
    skipPreflight,
  );
}