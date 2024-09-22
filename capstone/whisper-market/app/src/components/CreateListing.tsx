import { useState } from "react";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { WhisperMarket } from "../utils/whisper_market";
import { randomBytes } from "crypto";
import { hashMessage } from "utils/utils";
import { generateKeyFromSignature } from "@civic/lexi/dist/lib/key";
import { useWallet } from "@solana/wallet-adapter-react";

export default function CreateListing({
  program,
  marketplace,
}: {
  program?: Program<WhisperMarket>;
  marketplace: web3.PublicKey;
}) {
  const wallet = useWallet();
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [tx, setTx] = useState("");
  const [listingAddress, setListingAddress] = useState<web3.PublicKey>();

  const createListing = async () => {
    if (!program) {
      return;
    }

    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return;
    }

    if (Buffer.from(message).length > 316) {
      console.log("message too long");
      return;
    }

    try {
      const priceSol = new BN(priceNum * 10 ** 9);
      const seed = new BN(randomBytes(8));

      const listing = web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          wallet.publicKey.toBuffer(),
          marketplace.toBuffer(),
          seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )[0];

      setListingAddress(listing);

      const key = await generateKeyFromSignature(wallet, listing.toBase58());
      const sellerKeypair = web3.Keypair.fromSeed(key);
      console.log(sellerKeypair.publicKey.toBase58());

      const messageHash = await hashMessage(message);

      const tx = await program.methods
        .list(seed, description, priceSol, messageHash, sellerKeypair.publicKey)
        .accounts({
          seller: wallet.publicKey,
          marketplace,
        })
        .rpc();

      setTx(tx);
    } catch (error) {
      console.log("error", error);
    }
  };

  return (
    <>
      <input
        type="text"
        placeholder="Price"
        className="input input-bordered min-w-96"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <input
        type="text"
        placeholder="Description"
        className="input input-bordered min-w-96"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="textarea textarea-bordered min-w-96"
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      ></textarea>
      <button className="btn btn-neutral" onClick={createListing}>
        Create Listing
      </button>
      {tx && (
        <div className="text-sm font-normal align-bottom text-slate-600">
          https://explorer.solana.com/tx/{tx}?cluster=devnet
        </div>
      )}
      {listingAddress && (
        <div className="text-sm font-normal align-bottom text-slate-600">
          Listing address: {listingAddress?.toBase58()}
        </div>
      )}
    </>
  );
}
