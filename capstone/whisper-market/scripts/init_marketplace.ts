import wallet from "/home/user/.config/solana/id.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet, Program } from "@coral-xyz/anchor";
import { WhisperMarket } from "../target/types/whisper_market";
import idl from "../target/idl/whisper_market.json";

const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));
// const connection = new Connection("http://127.0.0.1:8899");
const connection = new Connection("https://api.devnet.solana.com");

const provider = new AnchorProvider(connection, new Wallet(keypair), {
  commitment: "confirmed",
});

const program: Program<WhisperMarket> = new Program(
  idl as WhisperMarket,
  provider
);

const MARKETPLACE_NAME = "Marketplace";
const FEE_BPS = 10;

(async () => {
  const marketplace = PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), Buffer.from(MARKETPLACE_NAME)],
    program.programId
  )[0];
  console.log(`Initializing Marketplace: ${marketplace}`);

  const tx = await program.methods
    .initialize(MARKETPLACE_NAME, FEE_BPS)
    .accounts({
      admin: keypair.publicKey,
    })
    .signers([keypair])
    .rpc();

  console.log(
    `Success! Check out your TX here: https://explorer.solana.com/tx/${tx}?cluster=devnet`
  );
})();
