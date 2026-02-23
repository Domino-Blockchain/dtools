import * as BufferLayout from '@solana/buffer-layout';
import {
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';

import { Buffer } from 'buffer';
import { blob } from '@solana/buffer-layout';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenAAGbeQq5tGW2r5RoR3oauzN2EkNFiHNPw9q34s',
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'Dt8fRCpjeV6JDemhPmtcTKijgKdPxXHn9Wo9cXY5agtG',
);

export const BTCI_PROGRAM_ID = new PublicKey(
  'BTCi9FUjBVY3BSaqjzfhEPKVExuvarj8Gtfn4rJ5soLC',
);

export const USDT_PROGRAM_ID = new PublicKey(
  'USDTx3HDeSKemTNpycea2xxqJHQbo9veLvgWPTK1Vh1',
);

export const WRAPPED_DOMI_MINT = new PublicKey(
  'So11111111111111111111111111111111111111112',
);

export const MEMO_PROGRAM_ID = new PublicKey(
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
);

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'MetaXKaVt8cn9dGYns81au23cqBYUH4DU4WpC8tAbhQ',
);

const bigInt = (length) => (property) => {
  const layout = blob(length, property);

  const decode = layout.decode.bind(layout);
  const encode = layout.encode.bind(layout);

  layout.decode = (buffer, offset) => {
    const src = decode(buffer, offset);
    return toBigIntLE(Buffer.from(src));
  };

  layout.encode = (bigInt, buffer, offset) => {
    const src = toBufferLE(bigInt, length);
    return encode(src, buffer, offset);
  };

  return layout;
};

const u64 = bigInt(8);

const LAYOUT = BufferLayout.union(BufferLayout.u8('instruction'));
LAYOUT.addVariant(
  0,
  BufferLayout.struct([
    BufferLayout.u8('decimals'),
    BufferLayout.blob(32, 'mintAuthority'),
    BufferLayout.u8('freezeAuthorityOption'),
    BufferLayout.blob(32, 'freezeAuthority'),
  ]),
  'initializeMint',
);
LAYOUT.addVariant(1, BufferLayout.struct([]), 'initializeAccount');
LAYOUT.addVariant(7, BufferLayout.struct([u64('amount')]), 'mintTo');
LAYOUT.addVariant(8, BufferLayout.struct([u64('amount')]), 'burn');
LAYOUT.addVariant(9, BufferLayout.struct([]), 'closeAccount');
LAYOUT.addVariant(
  12,
  BufferLayout.struct([u64('amount'), BufferLayout.u8('decimals')]),
  'transferChecked',
);

const instructionMaxSpan = Math.max(
  ...Object.values(LAYOUT.registry).map((r) => r.span),
);

function encodeTokenInstructionData(instruction) {
  let b = Buffer.alloc(instructionMaxSpan);
  let span = LAYOUT.encode(instruction, b);
  return b.slice(0, span);
}

export function initializeMint({
  mint,
  decimals,
  mintAuthority,
  freezeAuthority,
}) {
  let keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    data: encodeTokenInstructionData({
      initializeMint: {
        decimals,
        mintAuthority: mintAuthority.toBuffer(),
        freezeAuthorityOption: !!freezeAuthority,
        freezeAuthority: (freezeAuthority || PublicKey.default).toBuffer(),
      },
    }),
    programId: TOKEN_PROGRAM_ID,
  });
}

export function initializeAccount({ account, mint, owner }) {
  let keys = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    data: encodeTokenInstructionData({
      initializeAccount: {},
    }),
    programId: TOKEN_PROGRAM_ID,
  });
}

export function transferChecked({
  source,
  mint,
  destination,
  amount,
  decimals,
  owner,
  programId,
}) {
  let keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    data: encodeTokenInstructionData({
      transferChecked: { amount, decimals },
    }),
    programId,
  });
}

export function mintTo({ mint, destination, amount, mintAuthority }) {
  let keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    data: encodeTokenInstructionData({
      mintTo: {
        amount,
      },
    }),
    programId: TOKEN_PROGRAM_ID,
  });
}

export function closeAccount({ source, destination, owner }) {
  const keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    data: encodeTokenInstructionData({
      closeAccount: {},
    }),
    programId: TOKEN_PROGRAM_ID,
  });
}

export function memoInstruction(memo) {
  return new TransactionInstruction({
    keys: [],
    data: Buffer.from(memo, 'utf-8'),
    programId: MEMO_PROGRAM_ID,
  });
}

class PublicKeyLayout extends BufferLayout.Blob {
  constructor(property) {
    super(32, property);
  }

  decode(b, offset) {
    return new PublicKey(super.decode(b, offset));
  }

  encode(src, b, offset) {
    return super.encode(src.toBuffer(), b, offset);
  }
}

function publicKeyLayout(property) {
  return new PublicKeyLayout(property);
}

export const OWNER_VALIDATION_PROGRAM_ID = new PublicKey(
  '4MNPdKu9wFMvEeZBMt3Eipfs5ovVWTJb31pEXDJAAxX5',
);

export const OWNER_VALIDATION_LAYOUT = BufferLayout.struct([
  publicKeyLayout('account'),
]);

export function encodeOwnerValidationInstruction(instruction) {
  const b = Buffer.alloc(OWNER_VALIDATION_LAYOUT.span);
  const span = OWNER_VALIDATION_LAYOUT.encode(instruction, b);
  return b.slice(0, span);
}

export function assertOwner({ account, owner }) {
  const keys = [{ pubkey: account, isSigner: false, isWritable: false }];
  return new TransactionInstruction({
    keys,
    data: encodeOwnerValidationInstruction({ account: owner }),
    programId: OWNER_VALIDATION_PROGRAM_ID,
  });
}

export async function signAndSendTransaction(
  connection,
  transaction,
  wallet,
  signers,
  skipPreflight = false,
) {
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash('max')
  ).blockhash;
  transaction.setSigners(
    // fee payed by the wallet owner
    wallet.publicKey,
    ...signers.map((s) => s.publicKey),
  );

  if (signers.length > 0) {
    transaction.partialSign(...signers);
  }

  transaction = await wallet.signTransaction(transaction);
  const rawTransaction = transaction.serialize();
  return await connection.sendRawTransaction(rawTransaction, {
    skipPreflight,
    preflightCommitment: 'single',
  });
}

export function burn({ account, mint, amount, owner }) {
  let keys = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    data: encodeTokenInstructionData({
      burn: {
        amount,
      },
    }),
    programId: TOKEN_PROGRAM_ID,
  });
}