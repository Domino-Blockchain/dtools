import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { createAndInitializeMint, mintMoreTokens } from './mint.js';
import { burnTokens } from './burn.js';
import { transferTokens, createAndInitializeTokenAccount} from './transfer.js';
import { getNativeBalance, getTokenAccountBalance } from './balance.js';
import fs from 'fs';
import path from 'path';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import nacl from 'tweetnacl';

const RPC_URL = 'https://api.devnet.domichain.io';
const KEYPAIR_DIR = './keypairs';
const MNEMONIC_PATH = path.join('./keypairs', 'mnemonic.txt');

// Ensure keypair directory exists
if (!fs.existsSync(KEYPAIR_DIR)) {
  fs.mkdirSync(KEYPAIR_DIR, { recursive: true });
}

/**
 * Load or generate a keypair from file
 */
function loadOrGenerateKeypair(filename) {
  const filepath = path.join(KEYPAIR_DIR, filename);
  
  if (fs.existsSync(filepath)) {
    console.log(`  Loading existing keypair: ${filename}`);
    const secretKey = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } else {
    console.log(`  Generating new keypair: ${filename}`);
    const keypair = Keypair.generate();
    fs.writeFileSync(filepath, JSON.stringify(Array.from(keypair.secretKey)));
    return keypair;
  }
}

/**
 * Take a keypair from a twelve-seed mnemonic
 */
export function keypairFromMnemonic(mnemonic, accountIndex = 0) {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Domi standard derivation path
  const derivationPath = `m/44'/501'/${accountIndex}'/0'`;

  const derivedSeed = derivePath(
    derivationPath,
    seed.toString('hex')
  ).key;

  const keypair = nacl.sign.keyPair.fromSeed(derivedSeed);

  return Keypair.fromSecretKey(keypair.secretKey);
}

/**
 * Load or generate a keypair from file Mnemonic version
 */
function loadOrGenerateMnemonic() {
  if (fs.existsSync(MNEMONIC_PATH)) {
    return fs.readFileSync(MNEMONIC_PATH, 'utf-8').trim();
  }

  const mnemonic = bip39.generateMnemonic(128); // 12 words
  fs.writeFileSync(MNEMONIC_PATH, mnemonic);
  console.log('\nGenerated New Mnemonic (SAVE THIS SAFELY):\n');
  console.log(mnemonic);
  console.log('\n');
  return mnemonic;
}

/**
 * Request airdrop for testing on devnet
 */
async function requestAirdrop(
  connection,
  publicKey,
  amount
) {
  try {
    console.log(`💰 Requesting ${amount} DOMI airdrop for ${publicKey.toBase58()}...`);
    const signature = await connection.requestAirdrop(
      publicKey,
      amount * 1_000_000_000
    );
    await connection.confirmTransaction(signature);
    console.log(`✓ Airdrop confirmed`);
  } catch (error) {
    console.warn(`⚠️  Airdrop failed (may have reached limit):`, error);
  }
}


/**
 * Create wallet object for signing transactions
 */
function createWallet(keypair, additionalSigners = []) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => {
      tx.sign(keypair, ...additionalSigners);
      return tx;
    },
  };
}

/**
 * Wait for confirmation with retries
 */
async function confirmTransaction(connection, signature, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await connection.confirmTransaction(signature, 'confirmed');
      if (result.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
      }
      return result;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function runProductionTest() {
  console.log('=======================================================');
  console.log('Production Integration Test - Domichain Testnet');
  console.log('=======================================================\n');
  console.log(`RPC URL: ${RPC_URL}\n`);

  // 链接到多米链
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load or generate keypairs
  // 创建新钱包
  // No key phrase:
  /*
  console.log('Loading/Generating Keypairs...');
  const ownerKeypair = loadOrGenerateKeypair('owner.json');
  const recipientKeypair = loadOrGenerateKeypair('recipient.json');
  const mintKeypair = loadOrGenerateKeypair('mint.json');
  const ownerTokenAccount = loadOrGenerateKeypair('owner-token-account.json');
  const recipientTokenAccount = loadOrGenerateKeypair('recipient-token-account.json');
  */
  
  // With keyphrase
  const mnemonic = loadOrGenerateMnemonic();

  const ownerKeypair = keypairFromMnemonic(mnemonic, 0);
  const recipientKeypair = keypairFromMnemonic(mnemonic, 1);
  const mintKeypair = keypairFromMnemonic(mnemonic, 2);
  const ownerTokenAccount = keypairFromMnemonic(mnemonic, 3);
  const recipientTokenAccount = keypairFromMnemonic(mnemonic, 4);

  console.log('\n=======================================================');
  console.log('Account Addresses:');
  console.log('=======================================================');
  console.log(`Owner:                  ${ownerKeypair.publicKey.toBase58()}`);
  console.log(`Recipient:              ${recipientKeypair.publicKey.toBase58()}`);
  console.log(`Mint:                   ${mintKeypair.publicKey.toBase58()}`);
  console.log(`Owner Token Account:    ${ownerTokenAccount.publicKey.toBase58()}`);
  console.log(`Recipient Token Account: ${recipientTokenAccount.publicKey.toBase58()}`);
  console.log('=======================================================\n');

  const TOKEN_DECIMALS = 9;
  const INITIAL_SUPPLY = BigInt(1000000000000); // 1000 tokens with 9 decimals

  // Check balances 查看当前余额
  console.log('Checking Native Balances...');
  try {
    const ownerBalance = await getNativeBalance(connection, ownerKeypair.publicKey);
    const recipientBalance = await getNativeBalance(connection, recipientKeypair.publicKey);
    console.log(`  Owner Balance:     ${ownerBalance / 1e9} DOMI`);
    console.log(`  Recipient Balance: ${recipientBalance / 1e9} DOMI`);
    
    if (ownerBalance === 0) {
      await requestAirdrop(connection, ownerKeypair.publicKey, 1);
    }
  } catch (error) {
    console.error(`  Error checking balances: ${error.message}`);
  }

  // 创建新币
  console.log('\n=======================================================');
  console.log('Step 1: Create and Initialize Mint 创建新币');
  console.log('=======================================================');
  
  try {
    // Check if mint already exists
    const existingMint = await connection.getAccountInfo(mintKeypair.publicKey);
    
    if (existingMint) {
      console.log('✓ Mint already exists, skipping creation');
      console.log(`  Mint: ${mintKeypair.publicKey.toBase58()}`);
      
      // Check if owner token account exists
      const existingOwnerAccount = await connection.getAccountInfo(ownerTokenAccount.publicKey);
      if (existingOwnerAccount) {
        const balance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
        console.log(`  Owner Token Account: ${ownerTokenAccount.publicKey.toBase58()}`);
        console.log(`  Current Balance: ${balance.uiAmount} tokens`);
      }
    } else {
      console.log('Creating new mint and initial token account...');

      // 创建代币账号
      const ownerWallet = createWallet(ownerKeypair, [mintKeypair, ownerTokenAccount]);

      //调用API，创建新的代币 （系统只需要做一次积分代币）
      const txSig = await createAndInitializeMint({
        connection,
        owner: ownerWallet,
        mint: mintKeypair,
        amount: INITIAL_SUPPLY, // 创建多少代币
        decimals: TOKEN_DECIMALS, // 小数点精度
        initialAccount: ownerTokenAccount,
      });
      
      console.log(`✓ Transaction Signature: ${txSig}`);
      console.log('  Confirming transaction...');

      // Check Transaction confirmation
      await confirmTransaction(connection, txSig);
      
      console.log('✓ Transaction confirmed!');
      console.log(`  Mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`  Owner Token Account: ${ownerTokenAccount.publicKey.toBase58()}`);
      
      // 代币余额显示
      const balance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
      console.log(`  Balance: ${balance.uiAmount} tokens`);
      console.log(`  Decimals: ${balance.decimals}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
  }

  // 第二步：增加积分代币 500 个
  console.log('\n=======================================================');
  console.log('Step 2: Mint Additional Tokens 增加500个币');
  console.log('=======================================================');
  
  try {
    const MINT_AMOUNT = BigInt(500000000000); // 500 tokens
    
    console.log(`Minting ${Number(MINT_AMOUNT) / 1e9} additional tokens...`);
    
    const ownerWallet = createWallet(ownerKeypair);
    
    const txSig = await mintMoreTokens({
      connection,
      mintAuthority: ownerWallet,
      mint: mintKeypair.publicKey,
      destination: ownerTokenAccount.publicKey,
      amount: MINT_AMOUNT, // 增加500个积分代币
    });
    
    console.log(`✓ Transaction Signature: ${txSig}`);
    console.log('  Confirming transaction...');
    
    await confirmTransaction(connection, txSig);
    
    console.log('✓ Transaction confirmed!');
    //  再次显示新的代币数量 1500 个
    const newBalance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
    console.log(`  New Balance: ${newBalance.uiAmount} tokens`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
  }

  console.log('\n=======================================================');
  console.log('Step 3: Create Recipient Account & Transfer Tokens 创建接受账号并转币到新账号');
  console.log('=======================================================');
  
  try {
    // Check if recipient token account already exists
    const existingRecipientAccount = await connection.getAccountInfo(recipientTokenAccount.publicKey);
    
    if (!existingRecipientAccount) {
      console.log('Creating recipient token account...');
      // 创建代币接受账号
      const payerWallet = createWallet(ownerKeypair, [recipientTokenAccount]);
      
      const txSig = await createAndInitializeTokenAccount({
        connection,
        payer: payerWallet,
        mintPublicKey: mintKeypair.publicKey,
        newAccount: recipientTokenAccount,
      });
      
      console.log(`✓ Transaction Signature: ${txSig}`);
      console.log('  Confirming transaction...');
      
      await confirmTransaction(connection, txSig);
      
      console.log('✓ Account created successfully!');
      console.log(`  Recipient Token Account: ${recipientTokenAccount.publicKey.toBase58()}`);
    } else {
      console.log('✓ Recipient token account already exists');
      const balance = await getTokenAccountBalance(connection, recipientTokenAccount.publicKey);
      console.log(`  Current Balance: ${balance.uiAmount} tokens`);
    }
    
    // 测试从第一账号发送代币到第二个账号
    // Transfer tokens
    const TRANSFER_AMOUNT = BigInt(250000000000); // 250 tokens
    console.log(`\n转币到新账号 Transferring ${Number(TRANSFER_AMOUNT) / 1e9} tokens...`);
    
    const ownerWallet = createWallet(ownerKeypair);
    
    // Get mint info for decimals
    const mintInfo = await connection.getAccountInfo(mintKeypair.publicKey);
    const decimalsOffset = 44;
    const decimals = mintInfo.data[decimalsOffset];
    
    // transferTokens returns a Transaction object, so we need to sign and send it
    const { signAndSendTransaction } = await import('./instructions.js');
    const transferTx = await transferTokens({
      connection,
      owner: ownerWallet,
      sourcePublicKey: ownerTokenAccount.publicKey,
      destinationPublicKey: recipientTokenAccount.publicKey,
      amount: TRANSFER_AMOUNT,
      mint: mintKeypair.publicKey,
      decimals: decimals,
    });
    
    const transferTxSig = await signAndSendTransaction(
      connection,
      transferTx,
      ownerWallet,
      []
    );
    
    console.log(`✓ Transfer Transaction Signature: ${transferTxSig}`);
    console.log('  转币成功 Confirming transaction...');
    
    await confirmTransaction(connection, transferTxSig);
    
    console.log('✓ Transfer confirmed!');
    
    const ownerBalance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
    const recipientBalance = await getTokenAccountBalance(connection, recipientTokenAccount.publicKey);
    
    console.log(`  Owner Balance:     ${ownerBalance.uiAmount} tokens`);
    console.log(`  Recipient Balance: ${recipientBalance.uiAmount} tokens`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
  }

  // 燃烧代币，一旦消费以后，需要减少系统里面积分数量，积分数量=代币数量，减少（燃烧）代币
  console.log('\n=======================================================');
  console.log('Step 4: 燃烧币测试 Burn Tokens');
  console.log('=======================================================');
  
  try {
    const BURN_AMOUNT = BigInt(100000000000); // 100 tokens
    
    console.log(`燃烧 Burning ${Number(BURN_AMOUNT) / 1e9} tokens from owner account...`);
    
    const ownerWallet = createWallet(ownerKeypair);
    
    // 燃烧代币（减少代币总数）
    const txSig = await burnTokens({
      connection,
      owner: ownerWallet,
      tokenAccount: ownerTokenAccount.publicKey,
      mint: mintKeypair.publicKey,
      amount: BURN_AMOUNT, // 减少/燃烧100个代币
    });
    
    console.log(`✓ Transaction Signature: ${txSig}`);
    console.log('  Confirming transaction...');
    
    await confirmTransaction(connection, txSig);
    
    console.log('✓ Burn confirmed!');
    
    const finalBalance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
    console.log(`  Final Owner Balance: ${finalBalance.uiAmount} tokens`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
  }

  console.log('\n=======================================================');
  console.log('查看币的数量 Final Token Balances:');
  console.log('=======================================================');
  
  try {
    const ownerBalance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
    const recipientBalance = await getTokenAccountBalance(connection, recipientTokenAccount.publicKey);
    
    console.log(`Owner:     ${ownerBalance.uiAmount} tokens`);
    console.log(`Recipient: ${recipientBalance.uiAmount} tokens`);
  } catch (error) {
    console.error(`Error fetching final balances: ${error.message}`);
  }
  
  console.log('\n=======================================================');
  console.log('测试完成 Test Complete!');
  console.log('=======================================================\n');
}

// Run the test
runProductionTest().catch(console.error);