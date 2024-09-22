import type { NextPage } from "next";
import Head from "next/head";
import { HomeView } from "../views";

const Home: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>Whisper Market</title>
        <meta
          name="description"
          content="Whisper Market"
        />
      </Head>
      <HomeView />
    </div>
  );
};

export default Home;
