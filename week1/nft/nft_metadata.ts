import wallet from "/home/user/.config/solana/id.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";

// Create a devnet connection
const umi = createUmi("https://api.devnet.solana.com");

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader());
umi.use(signerIdentity(signer));

(async () => {
  try {
    // Follow this JSON structure
    // https://docs.metaplex.com/programs/token-metadata/changelog/v1.0#json-structure

    const image =
      "https://arweave.net/KE1krt-q7JslTf7OCP76WiBSfznE61-mP3lXx5-P5AU";
    const metadata = {
      name: "Babushka's Rug",
      symbol: "BR",
      description: "The Best Rug",
      image,
      attributes: [
        { trait_type: "shape", value: "rectangle" },
        { trait_type: "size", value: "57 x 40 cm" },
        { trait_type: "material", value: "cotton" },
      ],
      properties: {
        files: [
          {
            type: "image/jpg",
            uri: image,
          },
        ],
      },
      creators: [{ address: keypair.publicKey, share: 100 }],
    };
    const myUri = await umi.uploader.uploadJson(metadata);
    console.log("Your metadata URI: ", myUri);
  } catch (error) {
    console.log("Oops.. Something went wrong", error);
  }
})();
