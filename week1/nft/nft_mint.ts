import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  signerIdentity,
  generateSigner,
  percentAmount,
} from "@metaplex-foundation/umi";
import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

import wallet from "/home/user/.config/solana/id.json";
import base58 from "bs58";

const RPC_ENDPOINT = "https://api.devnet.solana.com";
const umi = createUmi(RPC_ENDPOINT);

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const myKeypairSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(myKeypairSigner));
umi.use(mplTokenMetadata());

const mint = generateSigner(umi);

(async () => {
  let tx = createNft(umi, {
    mint,
    name: "Babushka's Rug",
    symbol: "BR",
    uri: "https://arweave.net/ADK6UIZFrVWztKxde-NwAEpgsyUHjVHDhfKSeo8EGbc",
    sellerFeeBasisPoints: percentAmount(100, 2),
  });
  let result = await tx.sendAndConfirm(umi);
  const signature = base58.encode(result.signature);

  console.log(
    `Succesfully Minted! Check out your TX here:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`
  );

  console.log("Mint Address: ", mint.publicKey);
})();


// https://explorer.solana.com/tx/2M88UK7RbZBxWbDEJKFtzvZdfQ1QasNXGizwnAR9MKQKZRp4nH55cUaoNr4Tqi695DVoQaZsxt81v5LwFxyp1mUB?cluster=devnet
// Mint Address:  5FdaesVs7pxQKhd9h1CVknRtpwaRYYtuPBDm4Dsufdug