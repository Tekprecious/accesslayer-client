import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreatorDetail, usePriceHistory } from '@/hooks/useCreators';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useCreatorProfileStaleIndicator } from '@/hooks/useCreatorProfileStaleIndicator';
import { useOnChainMetadata } from '@/hooks/useOnChainMetadata';
import { resolveIpfsUrl } from '@/utils/ipfs.utils';
import CreatorBreadcrumb from '@/components/common/CreatorBreadcrumb';
import CreatorProfileHeader from '@/components/common/CreatorProfileHeader';
import CreatorProfileInfoGrid from '@/components/common/CreatorProfileInfoGrid';
import CreatorActivityFeed from '@/components/common/CreatorActivityFeed';
import CreatorProfileStaleIndicator from '@/components/common/CreatorProfileStaleIndicator';
import CreatorProfileStatRow from '@/components/common/CreatorProfileStatRow';
import BondingCurveChart from '@/components/common/BondingCurveChart';
import KeySimulationTool from '@/components/common/KeySimulationTool';
import BuyCooldownCountdown from '@/components/common/BuyCooldownCountdown';
import KeyHolderList from '@/components/common/KeyHolderList';
import HolderConcentrationChart from '@/components/common/HolderConcentrationChart';
import StakingRewardsSection from '@/components/common/StakingRewardsSection';
import DeprecationNotice from '@/components/common/DeprecationNotice';
import DeprecationBanner from '@/components/common/DeprecationBanner';
import SubscriptionAccessGate from '@/components/common/SubscriptionAccessGate';
import SectionErrorBoundary from '@/components/common/SectionErrorBoundary';
import { isKeyDeprecated } from '@/utils/keyDeprecation.utils';
import { Button } from '@/components/ui/button';
import { CreatorDashboardSkeleton } from '@/components/common/CreatorSkeleton';
import { bpsToPercent, formatNumber } from '@/utils/numberFormat.utils';
import {
	resolveCreatorKeyPriceStroops,
	formatDisplayKeyPrice,
} from '@/utils/keyPriceDisplay.utils';
import {
	resolveHighestBid,
	formatAuctionBidAmount,
} from '@/utils/auctionBid.utils';
import KeyDetailPageErrorBoundary from '@/components/common/KeyDetailPageErrorBoundary';
import { ApiError } from '@/services/api.service';
import WatchlistButton from '@/components/common/WatchlistButton';
import AuctionPhaseSection from '@/components/common/AuctionPhaseSection';
import { useAuctionPhase } from '@/hooks/useAuctionPhase';
import { useNavigationTiming } from '@/hooks/useNavigationTiming';
import { useKeyHolders } from '@/hooks/useKeyHolders';
import { useProfileStore } from '@/hooks/useProfileStore';
import { useWalletHoldings, useTradeMutation } from '@/hooks/useWallet';
import CoCreatorSection from '@/components/creator/CoCreatorSection';
import ShareTwitterButton from '@/components/common/ShareTwitterButton';
import { PriceHistoryChart } from '@/components/common/PriceHistoryChart';
import type { PriceHistoryInterval } from '@/services/course.service';
import TradeDialog from '@/components/common/TradeDialog';
import SpreadIndicator from '@/components/common/SpreadIndicator';
import OraclePriceIndicator from '@/components/common/OraclePriceIndicator';
import { useKeyOraclePrice } from '@/hooks/useKeyOraclePrice';
import showToast from '@/utils/toast.util';
import { getSignatureErrorMessage } from '@/utils/errorHandling.utils';
import { usePurchaseConfetti } from '@/hooks/usePurchaseConfetti';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useKeyTwap } from '@/hooks/useKeyTwap';
import { useKeyStats } from '@/hooks/useKeyStats';
import { useKeyUniqueTraders } from '@/hooks/useKeyUniqueTraders';
import { useKeyConfig } from '@/hooks/useKeyConfig';
import KeyStatsPanel from '@/components/common/KeyStatsPanel';
import Skeleton from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import GraduatedCurveMilestoneChart from '@/components/common/GraduatedCurveMilestoneChart';
import KeyDeprecationBanner from '@/components/common/KeyDeprecationBanner';
import MergeProposalBanner from '@/components/common/MergeProposalBanner';
import KeyBuybackModal from '@/components/common/KeyBuybackModal';
import type { KeyBuybackReceipt } from '@/hooks/useKeyBuyback';
import { usePerformanceBond } from '@/hooks/usePerformanceBond';
import PerformanceBondPanel from '@/components/common/PerformanceBondPanel';
import PriceAlertButton from '@/components/common/PriceAlertButton';
import {
	useTradeCooldownStatus,
	invalidateTradeCooldownStatus,
	resolveActiveTradeCooldown,
} from '@/hooks/useTradeCooldownStatus';
import {
	isActiveCooldown,
	type ActiveTradeCooldown,
} from '@/utils/tradeCooldown.utils';
import TradeCooldownButton from '@/components/common/TradeCooldownButton';

function CreatorDetailPageContent() {
	usePurchaseConfetti();

	const { id } = useParams<{ id: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const [hasMounted, setHasMounted] = useState(false);
	const [buybackModalOpen, setBuybackModalOpen] = useState(false);
	const [recentSettlement, setRecentSettlement] =
		useState<KeyBuybackReceipt | null>(null);
	const [deprecationDismissed, setDeprecationDismissed] = useState(false);
	const {
		data: creator,
		isLoading,
		error,
		isFetching,
		refetch,
	} = useCreatorDetail(id || '');

	const [interval, setInterval] = useState<PriceHistoryInterval>('24h');
	const { data: priceHistory, isLoading: isPriceHistoryLoading } =
		usePriceHistory(id || '', interval);

	useNavigationTiming('creator_profile');
	useDocumentTitle(creator ? `${creator.title} — AccessLayer` : null);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	const recordVisit = useRecentlyViewed(state => state.addKey);

	useEffect(() => {
		if (!creator) return;
		recordVisit({
			id: creator.id,
			title: creator.title || creator.name || 'Unnamed creator',
			price: creator.price,
			priceStroops: creator.priceStroops,
			change24h: creator.change24h,
			category: creator.category,
			avatarUri: creator.avatarUri || creator.thumbnail,
			walletAddress: creator.instructorId,
		});
	}, [creator, recordVisit]);

	const { holders, hasNextPage, isFetchingNextPage, fetchNextPage } =
		useKeyHolders(id || '');

	const profile = useProfileStore(state => state.profile);
	const userAddress = profile?.id;
	const { data: holdings = [] } = useWalletHoldings(userAddress ?? '');
	const userPosition = holdings.find(h => h.creatorId === (id || ''));
	const holdingsCount = userPosition?.quantity ?? 0;
	const nextBuyAllowedAt =
		userPosition?.nextBuyAllowedAt ?? creator?.nextBuyAllowedAt ?? null;
	const { data: twap, isLoading: isTwapLoading } = useKeyTwap(id || '');
	const {
		data: keyStats,
		isLoading: isKeyStatsLoading,
		isError: isKeyStatsError,
	} = useKeyStats(id || '');
	const { data: uniqueTraders, isLoading: isUniqueTradersLoading } =
		useKeyUniqueTraders(id || '');
	const { data: keyConfig, isLoading: isKeyConfigLoading } = useKeyConfig(
		id || ''
	);
	const spotPriceStroops = creator
		? resolveCreatorKeyPriceStroops(creator)
		: null;
	const {
		comparison: oracleComparison,
		freshness: oracleFreshness,
		source: oracleSource,
		isLoading: isOracleLoading,
	} = useKeyOraclePrice(id || '', { spotPriceStroops });

	const {
		data: performanceBondData,
		isLoading: isPerformanceBondLoading,
		isError: isPerformanceBondError,
	} = usePerformanceBond(id || '');
	const performanceBond =
		performanceBondData ?? creator?.performanceBond ?? null;

	const { phase: auctionPhase } = useAuctionPhase({
		auctionPrice: creator?.auctionPrice ?? null,
		auctionSupply: creator?.auctionSupply ?? null,
		auctionSold: creator?.auctionSold ?? null,
		auctionEndsAt: creator?.auctionEndsAt ?? null,
	});

	const isWhitelistGateActive = Boolean(
		creator?.isWhitelistEnabled ?? creator?.whitelistEnabled ?? false
	);
	const isUserWhitelisted = userAddress
		? Boolean(
				(creator?.whitelist ?? []).some(
					w => w.walletAddress.toUpperCase() === userAddress.toUpperCase()
				) ||
				(creator?.instructorId &&
					creator.instructorId.toUpperCase() === userAddress.toUpperCase())
			)
		: false;
	const isLockedOut = isWhitelistGateActive && !isUserWhitelisted;

	const {
		data: onChainMetadata,
		isLoading: isOnChainLoading,
		isError: isOnChainError,
		refetch: refetchOnChainMetadata,
	} = useOnChainMetadata(id || '');

	const isFallbackActive = isOnChainError || !onChainMetadata;
	const metadata = onChainMetadata ?? {};

	const displayName =
		metadata.name || creator?.title || creator?.name || 'Unnamed creator';
	const displaySymbol = metadata.symbol;
	const displayDescription =
		metadata.description || creator?.description || creator?.bio;
	const rawAvatar =
		metadata.image ||
		metadata.imageCid ||
		metadata.image_cid ||
		metadata.ipfsCid ||
		metadata.ipfs_cid ||
		metadata.avatarUri ||
		metadata.avatar_uri ||
		metadata.cid;
	const displayAvatar =
		resolveIpfsUrl(rawAvatar) || creator?.avatarUri || creator?.thumbnail;

	const { shouldShowBadge, handleRefetch } = useCreatorProfileStaleIndicator(
		id || '',
		isFetching || isOnChainLoading,
		() => {
			void refetch();
			void refetchOnChainMetadata();
		}
	);

	const [buyDialogOpen, setBuyDialogOpen] = useState(false);
	const [tradeSubmitting, setTradeSubmitting] = useState(false);
	const tradeMutation = useTradeMutation(userAddress ?? 'demo-wallet');

	const queryClient = useQueryClient();
	const { data: tradeCooldownStatus } = useTradeCooldownStatus(id || '');
	const tradeCooldown: ActiveTradeCooldown | null = resolveActiveTradeCooldown(
		tradeCooldownStatus,
		nextBuyAllowedAt
	);
	const isTradeCooldownActive = isActiveCooldown(tradeCooldown);

	const handleConfirmBuy = async (
		amount: number,
		_pricePreview?: unknown,
		slippage?: { maxPriceStroops: number | null } | null
	) => {
		setTradeSubmitting(true);
		try {
			showToast.loading(
				`Submitting buy for ${amount} key${amount === 1 ? '' : 's'}...`
			);
			await tradeMutation.mutateAsync({
				creatorId: id || '',
				amount,
				priceStroops: creator
					? resolveCreatorKeyPriceStroops(creator)
					: null,
				price: creator?.price,
				maxPriceStroops: slippage?.maxPriceStroops ?? null,
			});
			showToast.transactionSuccess(
				'Trade confirmed',
				`Bought ${formatNumber(amount)} key${amount === 1 ? '' : 's'} from ${
					creator?.title || 'Creator'
				}`
			);
			setBuyDialogOpen(false);
		} catch (error) {
			showToast.error(getSignatureErrorMessage(error));
		} finally {
			if (id) invalidateTradeCooldownStatus(queryClient, id);
			setTradeSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<main className="min-h-screen bg-[#06111f] px-6 py-16 text-white md:px-12">
				<div className="mx-auto max-w-7xl">
					<CreatorDashboardSkeleton />
				</div>
			</main>
		);
	}

	if (error || !creator) {
		const is404 =
			!creator || (error instanceof ApiError && error.status === 404);
		if (is404) {
			return (
				<main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#06111f] px-6 py-16 text-center text-white">
					<h1 className="font-grotesque text-3xl font-black">
						Creator not found
					</h1>
					<p className="text-white/70 font-jakarta">
						We couldn't find a creator with that ID.
					</p>
					<Link to="/creators" className="text-amber-400 hover:underline">
						Back to creators
					</Link>
				</main>
			);
		}
		throw error;
	}

	const feeItems = [
		{
			label: 'Creator fee',
			value: bpsToPercent(creator.creatorFeeBps),
			helperText: 'Fee paid directly to the creator on each trade.',
		},
		{
			label: 'Protocol fee',
			value: bpsToPercent(creator.protocolFeeBps),
			helperText: 'Fee paid to the platform for protocol maintenance.',
		},
	];

	const auctionLeadBid =
		auctionPhase === 'active'
			? resolveHighestBid(creator.auctionBids, creator.auctionHighestBid)
			: null;
	const auctionStatValue =
		auctionLeadBid != null
			? formatAuctionBidAmount(auctionLeadBid)
			: creator.auctionPrice != null && creator.auctionPrice > 0
				? formatAuctionBidAmount(creator.auctionPrice)
				: '—';

	const statItems = [
		{
			label:
				auctionPhase === 'active' ? 'Current Highest Bid' : 'Current Price',
			value:
				auctionPhase === 'active'
					? auctionStatValue
					: formatDisplayKeyPrice(resolveCreatorKeyPriceStroops(creator)),
		},
		{
			label: 'Key Supply',
			value: formatNumber(creator.creatorShareSupply ?? 100),
		},
		{
			label: '24h Volume',
			value: formatDisplayKeyPrice(creator.volume24h ?? 0),
		},
		{
			label: 'Total Holders',
			value: formatNumber(
				creator.creatorShareSupply
					? Math.ceil(creator.creatorShareSupply / 2)
					: 10
			),
		},
	];

	const chartData = (
		creator.priceHistory && creator.priceHistory.length > 0
			? creator.priceHistory
			: [1000000, 1200000, 1500000, 1800000, 2000000]
	).map((priceStroops, index) => ({
		supply: (index + 1) * 20,
		priceXLM: priceStroops / 10_000_000,
	}));
	const spotPrice = resolveCreatorKeyPriceStroops(creator);
	const twapPrice = twap?.priceStroops ?? null;
	const twapDelta =
		twapPrice != null && spotPrice != null ? twapPrice - spotPrice : null;

	const hasRealStakingData =
		creator.stakingPoolBalance != null ||
		creator.totalStaked != null ||
		creator.recentFeeInflow != null;
	const stakingStats = hasRealStakingData
		? {
				stakingPoolBalance: creator.stakingPoolBalance,
				totalStaked: creator.totalStaked,
				recentFeeInflow: creator.recentFeeInflow,
			}
		: {
				stakingPoolBalance: 4820,
				totalStaked: creator.creatorShareSupply
					? Math.floor(creator.creatorShareSupply / 4)
					: 25,
				recentFeeInflow: 62,
			};

	return (
		<main className="min-h-screen bg-[#06111f] px-6 py-16 text-white md:px-12">
			<div className="mx-auto max-w-7xl space-y-8">
				{creator.deprecation && !deprecationDismissed && (
					<DeprecationBanner
						deprecation={creator.deprecation}
						onDismiss={() => setDeprecationDismissed(true)}
					/>
				)}
				<CreatorBreadcrumb
					parentLabel="Marketplace"
					parentHref="/"
					currentLabel={`${creator.title} Profile`}
				/>
				{isKeyDeprecated(creator) && (
					<KeyDeprecationBanner
						creator={creator}
						userAddress={userAddress}
						holdingsCount={holdingsCount}
						onInitiateBuyback={() => setBuybackModalOpen(true)}
						recentSettlement={recentSettlement}
					/>
				)}
				<MergeProposalBanner
					sourceKeyId={id || ''}
					holdingsCount={holdingsCount}
					isConnected={Boolean(userAddress)}
				/>
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1 space-y-2">
						<CreatorProfileStaleIndicator
							visible={shouldShowBadge || isFallbackActive}
							isRefetching={isFetching || isOnChainLoading}
							onRefresh={() => {
								void refetch();
								void refetchOnChainMetadata();
							}}
						/>
						<CreatorProfileHeader
							name={displayName}
							symbol={displaySymbol}
							handle={creator.socialHandle || creator.instructorId}
							creatorId={creator.id}
							isVerified={creator.isVerified}
							avatarUrl={displayAvatar}
							bio={displayDescription}
							priceStroops={resolveCreatorKeyPriceStroops(creator)}
							showBackButton={hasMounted}
							isOnChainLoading={isOnChainLoading}
							onBack={() => {
								if (
									window.history.length > 1 &&
									location.key !== 'default'
								) {
									navigate(-1);
									return;
								}
								navigate('/creators');
							}}
						/>
					</div>
					<WatchlistButton
						creator={creator}
						labelName={displayName}
						className="mt-3 shrink-0"
					/>
				</div>
				<SectionErrorBoundary sectionName="price history">
					<PriceHistoryChart
						data={priceHistory}
						interval={interval}
						isLoading={isPriceHistoryLoading}
						onIntervalChange={setInterval}
					/>
				</SectionErrorBoundary>
				<div data-testid="creator-stat-cards">
					<CreatorProfileStatRow items={statItems} />
				</div>
				<SectionErrorBoundary sectionName="key statistics">
					<KeyStatsPanel
						stats={keyStats}
						isLoading={isKeyStatsLoading}
						isError={isKeyStatsError}
						uniqueTraders={uniqueTraders}
						isUniqueTradersLoading={isUniqueTradersLoading}
					/>
				</SectionErrorBoundary>
				<SectionErrorBoundary sectionName="performance bond">
					<PerformanceBondPanel
						bond={performanceBond}
						isLoading={isPerformanceBondLoading}
						isError={isPerformanceBondError}
					/>
				</SectionErrorBoundary>
				{isKeyDeprecated(creator) && (
					<div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
						<DeprecationNotice reason={creator.deprecationReason} />
					</div>
				)}
				<div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wider text-white/55">
							Key Purchase
						</p>
						<p className="mt-0.5 text-sm text-white/80">
							{isKeyDeprecated(creator)
								? 'Key is deprecated. New buys are disabled.'
								: isLockedOut
									? 'Early access is restricted to approved whitelisted wallets.'
									: 'Purchase keys for this creator.'}
						</p>
						<SpreadIndicator
							className="mt-2"
							buyPriceStroops={keyConfig?.buyPriceStroops}
							sellPriceStroops={keyConfig?.sellPriceStroops}
							spreadStroops={keyConfig?.spreadStroops}
							spreadBps={keyConfig?.spreadBps}
							isLoading={isKeyConfigLoading}
						/>
						<OraclePriceIndicator
							className="mt-2"
							comparison={oracleComparison}
							freshness={oracleFreshness}
							source={oracleSource}
							isLoading={isOracleLoading}
						/>
					</div>
					<div className="flex items-center gap-2">
						<PriceAlertButton
							userId={userAddress}
							keyId={creator.id}
							keyName={creator.title || creator.name || 'Creator Key'}
							currentPrice={resolveCreatorKeyPriceStroops(creator) ?? 0}
						/>
						{isKeyDeprecated(creator) ? (
							<Button
								disabled
								data-testid="key-detail-buy-button"
								variant="outline"
								className="min-h-11 w-full rounded-xl font-bold sm:h-10 sm:min-h-0 sm:w-auto"
							>
								Buy Disabled (Deprecated)
							</Button>
						) : (
							<TradeCooldownButton
								cooldown={tradeCooldown}
								label="Buy Key"
								className="min-h-11 w-full rounded-xl font-bold sm:h-10 sm:min-h-0 sm:w-auto"
								onClick={() => setBuyDialogOpen(true)}
								buttonProps={{ 'data-testid': 'key-detail-buy-button' }}
							/>
						)}
					</div>
				</div>
				{auctionPhase !== 'inactive' && (
					<AuctionPhaseSection
						creatorId={creator.id}
						auctionPrice={creator.auctionPrice}
						auctionSupply={creator.auctionSupply}
						auctionSold={creator.auctionSold}
						auctionEndsAt={creator.auctionEndsAt}
						auctionMinIncrement={creator.auctionMinIncrement}
						auctionHighestBid={creator.auctionHighestBid}
						auctionBids={creator.auctionBids}
					/>
				)}
				{userAddress && !isTradeCooldownActive && (
					<BuyCooldownCountdown nextBuyAllowedAt={nextBuyAllowedAt} />
				)}
				<div className="flex justify-end">
					<ShareTwitterButton
						creatorId={creator.id}
						creatorName={creator.title}
						priceXlm={formatDisplayKeyPrice(
							resolveCreatorKeyPriceStroops(creator)
						).replace(' XLM', '')}
						userAddress={userAddress}
						userHoldingsCount={holdingsCount}
					/>
				</div>
				{auctionPhase !== 'active' &&
					(isTwapLoading ? (
						<div
							className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
							data-testid="twap-price"
						>
							<div aria-label="Loading 24 hour TWAP" role="status">
								<Skeleton className="h-3 w-24" />
								<Skeleton className="mt-2 h-6 w-32" />
							</div>
						</div>
					) : twapPrice != null ? (
						<div
							className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
							data-testid="twap-price"
						>
							<div className="flex items-center justify-between gap-4">
								<div>
									<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
										<span
											className={
												twapDelta != null
													? twapDelta < 0
														? 'text-emerald-400'
														: 'text-rose-400'
													: ''
											}
										>
											TWAP (24h)
										</span>
										<Tooltip content="Time-weighted average price over the past 24 hours. Less sensitive to short-term manipulation.">
											<button
												type="button"
												aria-label="What is 24 hour TWAP?"
												className="text-white/50"
											>
												ⓘ
											</button>
										</Tooltip>
									</div>
									<div className="mt-1 text-xl font-bold text-white">
										{formatDisplayKeyPrice(twapPrice)}
									</div>
								</div>
								{twapDelta != null && (
									<span
										className={
											twapDelta < 0
												? 'text-sm font-semibold text-emerald-400'
												: 'text-sm font-semibold text-rose-400'
										}
									>
										{twapDelta < 0 ? '▼' : '▲'}{' '}
										{formatDisplayKeyPrice(Math.abs(twapDelta))} vs spot
									</span>
								)}
							</div>
						</div>
					) : null)}
				<StakingRewardsSection {...stakingStats} isLoading={isLoading} />
				{auctionPhase !== 'active' && (
					<div
						className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8"
						data-testid="creator-chart-container"
					>
						<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
							Price Curve
						</h2>
						<BondingCurveChart
							data={chartData}
							currentSupply={creator.creatorShareSupply ?? 100}
							height={300}
						/>
					</div>
				)}
				<SectionErrorBoundary sectionName="curve milestones">
					<GraduatedCurveMilestoneChart
						keyId={creator.id}
						currentSupply={creator.creatorShareSupply ?? 0}
					/>
				</SectionErrorBoundary>
				{auctionPhase !== 'active' && (
					<KeySimulationTool
						currentSupply={creator.creatorShareSupply ?? 100}
						protocolFeeBps={creator.protocolFeeBps}
						creatorFeeBps={creator.creatorFeeBps}
					/>
				)}
				<div
					className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8"
					data-testid="holder-concentration-container"
				>
					<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
						Holder Concentration
					</h2>
					<SectionErrorBoundary sectionName="holder concentration">
						<HolderConcentrationChart
							holders={holders}
							totalSupply={creator.creatorShareSupply}
						/>
					</SectionErrorBoundary>
				</div>
				<div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8">
					<div className="flex items-center justify-between gap-4 mb-6">
						<h2 className="font-grotesque text-xl font-black tracking-tight text-white">
							Fee Structure
						</h2>
						<CreatorProfileStaleIndicator
							visible={shouldShowBadge}
							isRefetching={isFetching}
							onRefresh={handleRefetch}
						/>
					</div>
					<CreatorProfileInfoGrid items={feeItems} />
				</div>
				<SectionErrorBoundary sectionName="co-creator information">
					<CoCreatorSection
						courseId={creator.id}
						coCreatorAddress={creator.coCreatorAddress}
						coCreatorSplitBps={creator.coCreatorSplitBps}
						totalPaidToCoCreator={creator.totalPaidToCoCreator}
						totalPaidToCreator={creator.totalPaidToCreator}
					/>
				</SectionErrorBoundary>
				<div
					data-testid="creator-holders-container"
					className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8"
				>
					<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
						Key Holders
					</h2>
					<SectionErrorBoundary sectionName="key holders">
						<KeyHolderList
							holders={holders}
							hasNextPage={hasNextPage}
							isFetchingNextPage={isFetchingNextPage}
							fetchNextPage={() => {
								void fetchNextPage();
							}}
						/>
					</SectionErrorBoundary>
				</div>
				<div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8">
					<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
						Exclusive Content
					</h2>
					<SubscriptionAccessGate
						creatorId={creator.id}
						minimumHolding={1}
						onBuyClick={() => setBuyDialogOpen(true)}
					>
						<div className="rounded-xl bg-white/[0.03] p-6 border border-white/10">
							<p className="text-white/80">
								🎉 Welcome to the exclusive content section! Here you can access
								premium videos, articles, and perks from{' '}
								{creator.title || creator.name || 'this creator'}.
							</p>
						</div>
					</SubscriptionAccessGate>
				</div>
				<div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8">
					<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
						Activity
					</h2>
					<SectionErrorBoundary sectionName="creator activity">
						<CreatorActivityFeed creatorId={creator.id} />
					</SectionErrorBoundary>
				</div>
				{isKeyDeprecated(creator) && (
					<KeyBuybackModal
						open={buybackModalOpen}
						onOpenChange={setBuybackModalOpen}
						creatorId={creator.id}
						creatorTitle={creator.title || creator.name || 'Creator Key'}
						holdingsCount={holdingsCount}
						buybackPriceStroops={resolveCreatorKeyPriceStroops(creator) ?? 0}
						userAddress={userAddress}
						onSettled={receipt => {
							setRecentSettlement(receipt);
						}}
					/>
				)}
				{creator && (
					<TradeDialog
						open={buyDialogOpen}
						side="buy"
						creatorName={creator.title || creator.name || 'Creator'}
						availableHoldings={holdingsCount}
						keyPriceStroops={resolveCreatorKeyPriceStroops(creator)}
						currentSupply={creator.creatorShareSupply}
						maxBuyQuantity={creator.maxBuyQuantity}
						launchPenaltyBps={creator.launchPenaltyBps}
						keyConfig={keyConfig}
						isKeyConfigLoading={isKeyConfigLoading}
						onOpenChange={setBuyDialogOpen}
						onConfirm={handleConfirmBuy}
						isSubmitting={tradeSubmitting}
						requireConfirmation={true}
					/>
				)}
			</div>
		</main>
	);
}

export default function CreatorDetailPage() {
	return (
		<KeyDetailPageErrorBoundary>
			<CreatorDetailPageContent />
		</KeyDetailPageErrorBoundary>
	);
}
