import React, { useState, useEffect, useMemo } from 'react';
import { TokenInfo } from '@baf-wallet/chain-info';

export interface Tokens {
	[symbol: string]: TokenInfo
}

export interface CoinPickerProps {
	onChange: (token: TokenInfo) => void;
	defaultToken: TokenInfo,
	supportedTokens: Tokens;
}

export function CoinPicker({ onChange, defaultToken, supportedTokens }: CoinPickerProps) {
	const [selectedToken, setSelectedToken] = useState<string>(defaultToken.symbol);

	useEffect(() => {
		onChange(supportedTokens[selectedToken]);
	}, [selectedToken]);

	return (
		<div>
			{/* <ul>
				{Object.keys(supportedTokens).map((symbol, i) => (
					<li key={i}>{symbol} chevron</li>
				))}
			</ul> */}
		</div>
	)
}