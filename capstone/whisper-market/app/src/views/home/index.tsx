import { FC, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import CreateListing from "components/CreateListing";
import idl from "../../utils/whisper_market.json";
import { WhisperMarket } from "../../utils/whisper_market";
import { Connection } from "@solana/web3.js";
import PurchaseListing from "components/PurchaseListing";
import CompletePurchase from "components/CompletePurchase";
import DecryptMessage from "components/DecryptMessage";

export const HomeView: FC = ({}) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [provider, setProvider] = useState<AnchorProvider>();
  const [program, setProgram] = useState<Program<WhisperMarket>>();
  const [marketplace, setMarketplace] = useState<web3.PublicKey>();

  const MARKETPLACE_NAME = "Marketplace";

  useEffect(() => {
    if (wallet.publicKey) {
      const connection = new Connection("http://127.0.0.1:8899");
      const provider = new AnchorProvider(
        connection,
        wallet,
        AnchorProvider.defaultOptions()
      );
      setProvider(provider);
      console.log(connection);

      const program = new Program(idl as WhisperMarket, provider);
      setProgram(program);

      setMarketplace(
        web3.PublicKey.findProgramAddressSync(
          [Buffer.from("marketplace"), Buffer.from(MARKETPLACE_NAME)],
          program.programId
        )[0]
      );
    }
  }, [connection, wallet]);

  return (
    <div className="md:hero mx-auto p-4">
      <div className="md:hero-content flex flex-col">
        <CreateListing program={program} marketplace={marketplace} />
        <div className="divider divider-info w-full"></div>
        <PurchaseListing program={program} marketplace={marketplace} />
        <div className="divider divider-info w-full"></div>
        <CompletePurchase program={program} marketplace={marketplace} />
        <div className="divider divider-info w-full"></div>
        <DecryptMessage program={program} />
      </div>
    </div>
  );
};
