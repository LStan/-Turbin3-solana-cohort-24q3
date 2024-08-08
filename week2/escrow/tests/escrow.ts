import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import {
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";

describe("escrow", () => {
  const TOKEN_A_EXCHANGE_AMOUNT = 3 * 1e6;
  const TOKEN_B_EXCHANGE_AMOUNT = 4 * 1e6;

  const ATA_DATA_SIZE = 165;
  const ESCROW_DATA_SIZE = 8 + 8 + 32 + 32 + 32 + 8 + 1;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<Escrow>;

  const wallet = provider.wallet as anchor.Wallet;

  const maker = anchor.web3.Keypair.generate();
  const taker = anchor.web3.Keypair.generate();

  console.log("Maker: ", maker.publicKey.toBase58());
  console.log("Taker: ", taker.publicKey.toBase58());

  let mintA: anchor.web3.PublicKey;
  let mintB: anchor.web3.PublicKey;

  let makerAtaA: anchor.web3.PublicKey;
  let takerAtaA: anchor.web3.PublicKey;

  let makerAtaB: anchor.web3.PublicKey;
  let takerAtaB: anchor.web3.PublicKey;

  let escrow: anchor.web3.PublicKey;
  let vault: anchor.web3.PublicKey;

  const seed = new anchor.BN(0);

  before(async () => {
    await airdrop(provider.connection, maker.publicKey);
    await airdrop(provider.connection, taker.publicKey);

    mintA = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6
    );
    mintB = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6
    );

    takerAtaA = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        mintA,
        taker.publicKey
      )
    ).address;
    makerAtaA = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        mintA,
        maker.publicKey
      )
    ).address;

    takerAtaB = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        mintB,
        taker.publicKey
      )
    ).address;
    makerAtaB = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        mintB,
        maker.publicKey
      )
    ).address;

    await mintTo(
      provider.connection,
      wallet.payer,
      mintA,
      makerAtaA,
      wallet.publicKey,
      10 * 1e6
    );

    await mintTo(
      provider.connection,
      wallet.payer,
      mintB,
      takerAtaB,
      wallet.publicKey,
      10 * 1e6
    );

    escrow = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8),
        mintA.toBuffer(),
        mintB.toBuffer(),
      ],
      program.programId
    )[0];

    vault = await getAssociatedTokenAddressSync(mintA, escrow, true);
  });

  it("Maker creates escrow", async () => {
    const tokenAmountBefore = (await getAccount(provider.connection, makerAtaA))
      .amount;

    const tx = await program.methods
      .make(
        seed,
        new anchor.BN(TOKEN_A_EXCHANGE_AMOUNT),
        new anchor.BN(TOKEN_B_EXCHANGE_AMOUNT)
      )
      .accounts({
        maker: maker.publicKey,
        mintA,
        mintB,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    // console.log("Your transaction signature", tx);

    const tokenAmountAfter = (await getAccount(provider.connection, makerAtaA))
      .amount;
    expect(tokenAmountAfter).to.equal(
      tokenAmountBefore - BigInt(TOKEN_A_EXCHANGE_AMOUNT)
    );

    const vaultTokenAmount = await getAccount(provider.connection, vault);
    expect(vaultTokenAmount.amount).to.equal(BigInt(TOKEN_A_EXCHANGE_AMOUNT));
  });

  it("Maker refunds", async () => {
    const makerBalanceBefore = await provider.connection.getBalance(
      maker.publicKey
    );

    const rentAta = await provider.connection.getMinimumBalanceForRentExemption(
      ATA_DATA_SIZE
    );
    const rentEscrow =
      await provider.connection.getMinimumBalanceForRentExemption(
        ESCROW_DATA_SIZE
      );
    const totalRent = rentAta + rentEscrow;

    const tokenAmountBefore = (await getAccount(provider.connection, makerAtaA))
      .amount;

    const tx = await program.methods
      .refund()
      .accountsPartial({
        maker: maker.publicKey,
        escrow,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    // console.log("Your transaction signature", tx);

    const tokenAmountAfter = (await getAccount(provider.connection, makerAtaA))
      .amount;
    expect(tokenAmountAfter).to.equal(
      tokenAmountBefore + BigInt(TOKEN_A_EXCHANGE_AMOUNT)
    );

    const makerBalanceAfter = await provider.connection.getBalance(
      maker.publicKey
    );
    expect(makerBalanceAfter).to.equal(makerBalanceBefore + totalRent);
  });

  it("Maker creates escrow again", async () => {
    const tokenAmountBefore = (await getAccount(provider.connection, makerAtaA))
      .amount;

    const tx = await program.methods
      .make(
        seed,
        new anchor.BN(TOKEN_A_EXCHANGE_AMOUNT),
        new anchor.BN(TOKEN_B_EXCHANGE_AMOUNT)
      )
      .accounts({
        maker: maker.publicKey,
        mintA,
        mintB,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    // console.log("Your transaction signature", tx);

    const tokenAmountAfter = (await getAccount(provider.connection, makerAtaA))
      .amount;
    expect(tokenAmountAfter).to.equal(
      tokenAmountBefore - BigInt(TOKEN_A_EXCHANGE_AMOUNT)
    );

    const vaultTokenAmount = await getAccount(provider.connection, vault);
    expect(vaultTokenAmount.amount).to.equal(BigInt(TOKEN_A_EXCHANGE_AMOUNT));
  });

  it("Taker takes", async () => {
    const takerBalanceBefore = await provider.connection.getBalance(
      taker.publicKey
    );

    const rentAta = await provider.connection.getMinimumBalanceForRentExemption(
      ATA_DATA_SIZE
    );
    const rentEscrow =
      await provider.connection.getMinimumBalanceForRentExemption(
        ESCROW_DATA_SIZE
      );
    const totalRent = rentAta + rentEscrow;

    const makerTokenBAmountBefore = (
      await getAccount(provider.connection, makerAtaB)
    ).amount;
    const takerTokenAAmountBefore = (
      await getAccount(provider.connection, takerAtaA)
    ).amount;
    const takerTokenBAmountBefore = (
      await getAccount(provider.connection, takerAtaB)
    ).amount;

    const tx = await program.methods
      .take()
      .accountsPartial({
        taker: taker.publicKey,
        escrow,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([taker])
      .rpc({
        // skipPreflight: true,
      });

    const makerTokenBAmountAfter = (
      await getAccount(provider.connection, makerAtaB)
    ).amount;

    const takerTokenAAmountAfter = (
      await getAccount(provider.connection, takerAtaA)
    ).amount;
    const takerTokenBAmountAfter = (
      await getAccount(provider.connection, takerAtaB)
    ).amount;
    const takerBalanceAfter = await provider.connection.getBalance(
      taker.publicKey
    );

    expect(makerTokenBAmountAfter).to.equal(
      makerTokenBAmountBefore + BigInt(TOKEN_B_EXCHANGE_AMOUNT)
    );
    expect(takerTokenBAmountAfter).to.equal(
      takerTokenBAmountBefore - BigInt(TOKEN_B_EXCHANGE_AMOUNT)
    );
    expect(takerTokenAAmountAfter).to.equal(
      takerTokenAAmountBefore + BigInt(TOKEN_A_EXCHANGE_AMOUNT)
    );

    expect(takerBalanceAfter).to.equal(takerBalanceBefore + totalRent);
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
