import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { WhisperMarket } from "../target/types/whisper_market";
import { assert, expect } from "chai";

describe("whisper-market", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WhisperMarket as Program<WhisperMarket>;

  const admin = web3.Keypair.generate();
  const seller = web3.Keypair.generate();
  const buyer = web3.Keypair.generate();

  const MARKETPLACE_NAME = "TestMarketplace";
  const FEE_BPS = 10;
  const PRICE = new anchor.BN(1000000000);

  let marketplace: web3.PublicKey;
  let treasury: web3.PublicKey;

  let listing1: web3.PublicKey;
  let listing2: web3.PublicKey;

  const seed1 = new anchor.BN(0);
  const seed2 = new anchor.BN(1);

  before(async () => {
    await airdrop(provider.connection, admin.publicKey);
    await airdrop(provider.connection, seller.publicKey);
    await airdrop(provider.connection, buyer.publicKey);

    marketplace = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace"), Buffer.from(MARKETPLACE_NAME)],
      program.programId
    )[0];
    treasury = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), marketplace.toBuffer()],
      program.programId
    )[0];

    listing1 = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        seller.publicKey.toBuffer(),
        marketplace.toBuffer(),
        seed1.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
    listing2 = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        seller.publicKey.toBuffer(),
        marketplace.toBuffer(),
        seed2.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
  });

  it("Admin initializes marketplace", async () => {
    const tx = await program.methods
      .initialize(MARKETPLACE_NAME, FEE_BPS)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Your transaction signature", tx);

    const marketplaceAccount = await program.account.marketplace.fetch(
      marketplace
    );
    expect(marketplaceAccount.name).to.equal(MARKETPLACE_NAME);
    expect(marketplaceAccount.feeBps).to.equal(FEE_BPS);
  });

  it("Seller creates listing", async () => {
    const description = "Test";
    const message_hash_stub = new Array(32).fill(0);
    const tx = await program.methods
      .list(seed1, description, PRICE, message_hash_stub)
      .accounts({
        seller: seller.publicKey,
        marketplace,
      })
      .signers([seller])
      .rpc();

    console.log("Your transaction signature", tx);

    const listingAccount = await program.account.listing.fetch(listing1);
    // expect(listingAccount.seller).to.deep.equal(seller.publicKey);
    expect(listingAccount.seller.equals(seller.publicKey)).to.be.true;
    expect(listingAccount.price.eq(PRICE)).to.be.true;
    expect(listingAccount.description).to.equal(description);
  });

  it("Another seller can't delist ", async () => {
    try {
      await program.methods
        .delist()
        .accountsPartial({
          seller: buyer.publicKey,
          listing: listing1,
        })
        .signers([buyer])
        .rpc();
      assert.fail();
    } catch (error) {
      expect(error.error.errorCode.code).to.equal("InvalidSeller");
    }
  });

  it("Seller can delist", async () => {
    const tx = await program.methods
      .delist()
      .accountsPartial({
        seller: seller.publicKey,
        listing: listing1,
      })
      .signers([seller])
      .rpc();
  });

  it("Seller creates listing again", async () => {
    const description = "Test";
    const message_hash_stub = new Array(32).fill(0);
    const tx = await program.methods
      .list(seed1, description, PRICE, message_hash_stub)
      .accounts({
        seller: seller.publicKey,
        marketplace,
      })
      .signers([seller])
      .rpc();

    console.log("Your transaction signature", tx);

    const listingAccount = await program.account.listing.fetch(listing1);
    expect(listingAccount.seller.equals(seller.publicKey)).to.be.true;
    expect(listingAccount.price.eq(PRICE)).to.be.true;
    expect(listingAccount.description).to.equal(description);
  });

  it("Buyer can purchase listing", async () => {
    const encrypt_key_hash_stub = new Array(32).fill(0);
    const nonce = getInt64Bytes(123);

    const balanceBefore = await provider.connection.getBalance(listing1);

    const tx = await program.methods
      .purchase(encrypt_key_hash_stub, nonce)
      .accountsPartial({
        buyer: buyer.publicKey,
        marketplace,
        listing: listing1,
      })
      .signers([buyer])
      .rpc();

    const listingAccount = await program.account.listing.fetch(listing1);
    expect(listingAccount.buyer.equals(buyer.publicKey)).to.be.true;
    expect(listingAccount.encryptKeyHash).to.deep.equal(encrypt_key_hash_stub);
    expect(listingAccount.encryptNonce).to.deep.equal(nonce);
    expect(listingAccount.state).to.deep.equal({ purchased: {} });

    const balanceAfter = await provider.connection.getBalance(listing1);
    expect(balanceAfter - balanceBefore).to.equal(
      PRICE.toNumber() + (FEE_BPS * PRICE.toNumber()) / 10000
    );
  });

  it("Buyer can't purchase listing again", async () => {
    try {
      const encrypt_key_hash_stub = new Array(32).fill(0);
      const nonce = getInt64Bytes(123);

      await program.methods
        .purchase(encrypt_key_hash_stub, nonce)
        .accountsPartial({
          buyer: buyer.publicKey,
          marketplace,
          listing: listing1,
        })
        .signers([buyer])
        .rpc();
      assert.fail();
    } catch (error) {
      expect(error.error.errorCode.code).to.equal("AlreadyPurchased");
    }
  });

  it("Buyer can cancel purchase", async () => {
    const tx = await program.methods
      .cancelPurchase()
      .accountsPartial({
        buyer: buyer.publicKey,
        marketplace,
        listing: listing1,
      })
      .signers([buyer])
      .rpc();

    const listingAccount = await program.account.listing.fetch(listing1);
    expect(listingAccount.buyer).to.deep.equal(null);
    expect(listingAccount.state).to.deep.equal({ listed: {} });
  });

  it("Buyer can purchase again", async () => {
    const encrypt_key_hash_stub = new Array(31).fill(0);
    const nonce = getInt64Bytes(123);

    const tx = await program.methods
      .purchase(encrypt_key_hash_stub, nonce)
      .accountsPartial({
        buyer: buyer.publicKey,
        marketplace,
        listing: listing1,
      })
      .signers([buyer])
      .rpc();
  });

  it("Another buyer can't cancel purchase", async () => {
    try {
      await program.methods
        .cancelPurchase()
        .accountsPartial({
          buyer: seller.publicKey,
          marketplace,
          listing: listing1,
        })
        .signers([seller])
        .rpc();
      assert.fail();
    } catch (error) {
      expect(error.error.errorCode.code).to.equal("InvalidBuyer");
    }
  });

  it("Seller can't delist purchased listing", async () => {
    try {
      await program.methods
        .delist()
        .accountsPartial({
          seller: seller.publicKey,
          listing: listing1,
        })
        .signers([seller])
        .rpc();
      assert.fail();
    } catch (error) {
      expect(error.error.errorCode.code).to.equal("AlreadyPurchased");
    }
  });

  it("Seller can complete purchase", async () => {
    const encrypted_message_stub = new Array(318).fill(0);
    const zk_proof_stub = Buffer.from("some proof");

    const sellerBalanceBefore = await provider.connection.getBalance(
      seller.publicKey
    );

    const treasuryBalanceBefore = await provider.connection.getBalance(
      treasury
    );

    const tx = await program.methods
      .completePurchase(encrypted_message_stub, zk_proof_stub)
      .accountsPartial({
        seller: seller.publicKey,
        marketplace,
        listing: listing1,
      })
      .signers([seller])
      .rpc();

    const listingAccount = await program.account.listing.fetch(listing1);
    expect(listingAccount.state).to.deep.equal({ completed: {} });
    expect(listingAccount.encryptedMessage).to.deep.equal(encrypted_message_stub);

    const sellerBalanceAfter = await provider.connection.getBalance(
      seller.publicKey
    );
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(PRICE.toNumber());

    const treasuryBalanceAfter = await provider.connection.getBalance(treasury);
    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
      (FEE_BPS * PRICE.toNumber()) / 10000
    );
  });

  it("Seller can't delist completed listing", async () => {
    try {
      await program.methods
        .delist()
        .accountsPartial({
          seller: seller.publicKey,
          listing: listing1,
        })
        .signers([seller])
        .rpc();
      assert.fail();
    } catch (error) {
      expect(error.error.errorCode.code).to.equal("AlreadyPurchased");
    }
  });
});

async function airdrop(connection: any, address: any, amount = 2000000000) {
  try {
    const airdropSignature = await connection.requestAirdrop(address, amount);

    const latestBlockHash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
  } catch (error) {
    console.error(error);
  }
}

function getInt64Bytes(x) {
  var bytes = [];
  for (var i = 0; i < 8; i++) {
    bytes[i] = x & 0xff; // Get the last byte
    x = x >> 8; // Shift right by 8 bits
  }
  return bytes;
}
