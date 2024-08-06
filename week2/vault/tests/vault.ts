import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { expect } from "chai";

describe("vault", () => {
  // Configure the client to use the local cluster.

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;

  const user = anchor.web3.Keypair.generate();

  const [vault, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.publicKey.toBytes()],
    program.programId
  );

  it("Is initialized!", async () => {
    await airdrop(provider.connection, user.publicKey);

    const tx = await program.methods
      .initialize()
      .accounts({ user: user.publicKey })
      .signers([user])
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Deposit", async () => {
    const amount = 1 * anchor.web3.LAMPORTS_PER_SOL;

    const userBalanceBefore = await provider.connection.getBalance(
      user.publicKey
    );

    const vaultBalanceBefore = await provider.connection.getBalance(vault);

    const tx = await program.methods
      .deposit(new anchor.BN(amount))
      .accounts({ user: user.publicKey })
      .signers([user])
      .rpc();
    console.log("Your transaction signature", tx);

    const userBalanceAfter = await provider.connection.getBalance(
      user.publicKey
    );

    const vaultBalanceAfter = await provider.connection.getBalance(vault);

    expect(userBalanceAfter - userBalanceBefore).to.equal(-amount);
    expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(amount);
  });

  it("Withdraw", async () => {
    const amount = 0.1 * anchor.web3.LAMPORTS_PER_SOL;

    const userBalanceBefore = await provider.connection.getBalance(
      user.publicKey
    );

    const vaultBalanceBefore = await provider.connection.getBalance(vault);

    const tx = await program.methods
      .withdraw(new anchor.BN(amount))
      .accounts({ user: user.publicKey })
      .signers([user])
      .rpc();
    console.log("Your transaction signature", tx);

    const userBalanceAfter = await provider.connection.getBalance(
      user.publicKey
    );
    const vaultBalanceAfter = await provider.connection.getBalance(vault);

    expect(userBalanceAfter - userBalanceBefore).to.equal(amount);
    expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(-amount);
  });

  it("Cannot withdraw more than balance", async () => {
    const amount = await provider.connection.getBalance(vault);

    let failed = false;
    try {
      const tx = await program.methods
        .withdraw(new anchor.BN(amount))
        .accounts({ user: user.publicKey })
        .signers([user])
        .rpc();
    } catch (e) {
      expect(e.error.errorMessage).to.equal("Not enough balance");
      failed = true;
    }
    expect(failed).to.equal(true);
  });

  it("Close", async () => {
    const userBalanceBefore = await provider.connection.getBalance(
      user.publicKey
    );
    const vaultBalanceBefore = await provider.connection.getBalance(vault);

    const tx = await program.methods
      .close()
      .accounts({ user: user.publicKey })
      .signers([user])
      .rpc();
    console.log("Your transaction signature", tx);

    const userBalanceAfter = await provider.connection.getBalance(
      user.publicKey
    );
    const vaultBalanceAfter = await provider.connection.getBalance(vault);

    expect(userBalanceAfter).to.equal(userBalanceBefore + vaultBalanceBefore);
    expect(vaultBalanceAfter).to.equal(0);
  });
});

async function airdrop(connection: any, address: any, amount = 2000000000) {
  await connection.confirmTransaction(
    await connection.requestAirdrop(address, amount),
    "confirmed"
  );
}
