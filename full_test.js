import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { createAndInitializeMint, mintMoreTokens } from './mint.js';
import { burnTokens } from './burn.js';
import { transferTokens, createAndInitializeTokenAccount } from './transfer.js';
import { getTokenAccountBalance } from './balance.js';
import { ACCOUNT_LAYOUT, MINT_LAYOUT } from './data.js';
import { TOKEN_PROGRAM_ID } from './instructions.js';

// Mock Blockchain State for Testing
class MockConnection {
  constructor() {
    this.accounts = new Map();
    this.balances = new Map();
    this.transactions = [];
  }

  async getBalance(publicKey) {
    return this.balances.get(publicKey.toBase58()) || 0;
  }

  async getAccountInfo(publicKey) {
    return this.accounts.get(publicKey.toBase58()) || null;
  }

  async getMinimumBalanceForRentExemption(size) {
    return size * 10;
  }

  async getRecentBlockhash(commitment) {
    return {
      blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
      feeCalculator: { lamportsPerSignature: 5000 },
    };
  }

  async sendRawTransaction(rawTx, options) {
    const sig = 'mock_tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    this.transactions.push({ sig, rawTx });
    return sig;
  }

  async confirmTransaction(sig) {
    return { value: { err: null } };
  }

  simulateTokenAccount(pubkey, mint, owner, amount) {
    const data = Buffer.alloc(ACCOUNT_LAYOUT.span);
    mint.toBuffer().copy(data, 0);
    owner.toBuffer().copy(data, 32);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));
    amountBuffer.copy(data, 64);
    
    this.accounts.set(pubkey.toBase58(), {
      data,
      executable: false,
      owner: TOKEN_PROGRAM_ID,
      lamports: 2039280,
    });
  }

  simulateMint(pubkey, decimals) {
    const data = Buffer.alloc(MINT_LAYOUT.span);
    data.writeUInt8(decimals, 44);
    
    this.accounts.set(pubkey.toBase58(), {
      data,
      executable: false,
      owner: TOKEN_PROGRAM_ID,
      lamports: 1461600,
    });
  }
}

// Mock wallet that signs with all required keypairs
function createMockWallet(keypair, additionalSigners = []) {
  return {
    publicKey: keypair.publicKey,
    _keypair: keypair,
    _additionalSigners: additionalSigners,
    signTransaction: async (tx) => {
      tx.sign(keypair, ...additionalSigners);
      return tx;
    },
  };
}

async function runIntegrationTest() {
  console.log('Testing Token Functions with Mock Connection\n');
  console.log('====================================================\n');

  // test connection  测试链接
  const connection = new MockConnection();
  
  // real connection to prod 链接到多米链
  // add code here to connect to domichain

  // 产生新钱包地址
  const ownerKeypair = Keypair.generate();
  const recipientKeypair = Keypair.generate();
  const mintKeypair = Keypair.generate();
  const ownerTokenAccount = Keypair.generate();
  const recipientTokenAccount = Keypair.generate();

  const TOKEN_DECIMALS = 9;
  const INITIAL_SUPPLY = BigInt(1000000000000);

  // 在上面的账户里面加进测试 DOMI 币
  connection.balances.set(ownerKeypair.publicKey.toBase58(), 10000000000); // 10 DOMI 实际需要0.5个
  connection.balances.set(recipientKeypair.publicKey.toBase58(), 10000000000); // 10 DOMI

  // 创建新币
  console.log('=== Step 1: Create and Initialize Mint ===');
  
  try {
    // 创建代币账号 ownertokenaccount
    // Create wallet that includes the additional signers
    const ownerWalletWithSigners = {
      publicKey: ownerKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(ownerKeypair, mintKeypair, ownerTokenAccount);
        return tx;
      },
    };

    // 调用API，创建新的代币 （系统只需要做一次积分代币）
    const txSig = await createAndInitializeMint({
      connection,
      owner: ownerWalletWithSigners,
      mint: mintKeypair,
      amount: INITIAL_SUPPLY, // 创建多少代币
      decimals: TOKEN_DECIMALS, // 小数点精度
      initialAccount: ownerTokenAccount,
    });
    
    console.log(`✓ Transaction created: ${txSig}`);
    console.log(`  Mint address: ${mintKeypair.publicKey.toBase58().slice(0, 20)}...`);
    
    // Simulate state AFTER successful transaction
    connection.simulateMint(mintKeypair.publicKey, TOKEN_DECIMALS);
    connection.simulateTokenAccount(
      ownerTokenAccount.publicKey,
      mintKeypair.publicKey,
      ownerKeypair.publicKey,
      INITIAL_SUPPLY
    );

    // 代币余额显示
    const balance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
    console.log(`  Balance: ${balance.uiAmount} tokens`);
    console.log(`  Decimals: ${balance.decimals}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    // Still set up state so subsequent tests can run
    connection.simulateMint(mintKeypair.publicKey, TOKEN_DECIMALS);
    connection.simulateTokenAccount(
      ownerTokenAccount.publicKey,
      mintKeypair.publicKey,
      ownerKeypair.publicKey,
      INITIAL_SUPPLY
    );
  }

  // 第二步：增加积分代币 500 个
  console.log('\n=== Step 2: Mint More Tokens ===');
  
  try {
    const ownerWallet = {
      publicKey: ownerKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(ownerKeypair);
        return tx;
      },
    };

    const txSig = await mintMoreTokens({
      connection,
      mintAuthority: ownerWallet,
      mint: mintKeypair.publicKey,
      destination: ownerTokenAccount.publicKey,
      amount: BigInt(500000000000), // 增加500个积分代币
    });
    
    console.log(`✓ Mint transaction created: ${txSig}`);
    
    connection.simulateTokenAccount(
      ownerTokenAccount.publicKey,
      mintKeypair.publicKey,
      ownerKeypair.publicKey,
      INITIAL_SUPPLY + BigInt(500000000000)
    );
    
    // 再次显示新的代币数量 1500 个
    const newBalance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
    console.log(`  New balance: ${newBalance.uiAmount} tokens`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }

  // 创建代币接受账号
  console.log('\n=== Step 3: Create Recipient Account ===');
  
  try {
    const recipientWallet = {
      publicKey: recipientKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(recipientKeypair, recipientTokenAccount);
        return tx;
      },
    };

    const txSig = await createAndInitializeTokenAccount({
      connection,
      payer: recipientWallet,
      mintPublicKey: mintKeypair.publicKey,
      newAccount: recipientTokenAccount,
    });
    
    console.log(`✓ Account creation transaction: ${txSig}`);
    
    connection.simulateTokenAccount(
      recipientTokenAccount.publicKey,
      mintKeypair.publicKey,
      recipientKeypair.publicKey,
      0n
    );
    
  } catch (error) {
    console.error('Error:', error.message);
  }

  // 燃烧代币，一旦消费以后，需要减少系统里面积分数量，积分数量=代币数量，减少（燃烧）代币
  console.log('\n=== Step 4: Burn Tokens ===');
  
  try {
    const ownerWallet = {
      publicKey: ownerKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(ownerKeypair);
        return tx;
      },
    };

    // 燃烧代币（减少代币总数）
    const txSig = await burnTokens({
      connection,
      owner: ownerWallet,
      tokenAccount: ownerTokenAccount.publicKey,
      mint: mintKeypair.publicKey,
      amount: BigInt(100000000000), // 减少/燃烧100个代币
    });
    
    console.log(`✓ Burn transaction created: ${txSig}`);
    
    const currentBalance = INITIAL_SUPPLY + BigInt(500000000000) - BigInt(100000000000);
    connection.simulateTokenAccount(
      ownerTokenAccount.publicKey,
      mintKeypair.publicKey,
      ownerKeypair.publicKey,
      currentBalance
    );
    
    // 代币减少后，显示新的代币数量 2350
    const finalBalance = await getTokenAccountBalance(connection, ownerTokenAccount.publicKey);
    console.log(`  Final balance: ${finalBalance.uiAmount} tokens`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n====================================================');
  console.log('Summary:');
  console.log(`  Total transactions created: ${connection.transactions.length}`);
  console.log('====================================================\n');
}

runIntegrationTest();