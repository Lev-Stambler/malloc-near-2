import "regenerator-runtime/runtime";
import { Splitter } from './pages/Splitter';
import { login } from "./utils";
import "./index.css";
import "./near.css";

import { logout } from './utils';

export default function App() {

  // if not signed in, return early with sign-in prompt
  if (!window.walletConnection.isSignedIn()) {
    return (
      <main>
        <h1>Welcome to NEAR!</h1>
        <p>
          To make use of the NEAR blockchain, you need to sign in. The button
          below will sign you in using NEAR Wallet.
        </p>
        <p>
          By default, when your app runs in "development" mode, it connects to a
          test network ("testnet") wallet. This works just like the main network
          ("mainnet") wallet, but the NEAR Tokens on testnet aren't convertible
          to other currencies – they're just for testing!
        </p>
        <p>Go ahead and click the button below to try it out:</p>
        <p style={{ textAlign: "center", marginTop: "2.5em" }}>
          <button onClick={login}>Sign in</button>
        </p>
      </main>
    );
  }

  return (
		// use React Fragment, <>, to avoid wrapping elements in unnecessary divs
		<>
			<button className="link" style={{ float: "right" }} onClick={logout}>
				Sign out
			</button>
			<main>
				<h1>Welcome {window.accountId}!</h1>
        <Splitter
          
        />
			</main>
		</>
  )
}

