node compile.js && \
	near dev-deploy target/wasm32-unknown-unknown/release/splitter.wasm && \
	(near call $(cat ./neardev/dev-account) new --accountId=levtester.testnet || true)