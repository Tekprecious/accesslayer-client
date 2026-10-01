import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useCreatorDetail } from '@/hooks/useCreators';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useCreatorProfileStaleIndicator } from '@/hooks/useCreatorProfileStaleIndicator';
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
import { isKeyDeprecated } from '@/utils/keyDeprecation.utils';
import { Button } from '@/components/ui/button';
import { CreatorDashboardSkeleton } from '@/components/common/CreatorSkeleton';
import { bpsToPercent, formatNumber } from '@/utils/numberFormat.utils';
import {
	resolveCreatorKeyPriceStroops,
	formatDisplayKeyPrice,
} from '@/utils/keyPriceDisplay.utils';
import KeyDetailPageErrorBoundary from '@/components/common/KeyDetailPageErrorBoundary';
import { ApiError } from '@/services/api.service';
import WatchlistButton from '@/components/common/WatchlistButton';
import { useNavigationTiming } from '@/hooks/useNavigationTiming';
import { useKeyHolders } from '@/hooks/useKeyHolders';
import { useProfileStore } from '@/hooks/useProfileStore';
import { useWalletHoldings, useTradeMutation } from '@/hooks/useWallet';
import CoCreatorSection from '@/components/creator/CoCreatorSection';
import ShareTwitterButton from '@/components/common/ShareTwitterButton';
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
import KeyDeprecationBanner from '@/components/common/KeyDeprecationBanner';
import MergeProposalBanner from '@/components/common/MergeProposalBanner';
import KeyBuybackModal from '@/components/common/KeyBuybackModal';
import type { KeyBuybackReceipt } from '@/hooks/useKeyBuyback';
import { usePerformanceBond } from '@/hooks/usePerformanceBond';
import PerformanceBondPanel from '@/components/common/PerformanceBondPanel';
import PriceAlertButton from '@/components/common/PriceAlertButton';

function CreatorDetailPageContent() {
	usePurchaseConfetti();

	const { id } = useParams<{ id: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const [hasMounted, setHasMounted] = useState(false);
	const [buybackModalOpen, setBuybackModalOpen] = useState(false);
	const [recentSettlement, setRecentSettlement] =
		useState<KeyBuybackReceipt | null>(null);
	const {
		data: creator,
		isLoading,
		error,
		isFetching,
		refetch,
	} = useCreatorDetail(id || '');
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

	const { shouldShowBadge, handleRefetch } = useCreatorProfileStaleIndicator(
		id || '',
		isFetching,
		() => refetch()
	);

	const [buyDialogOpen, setBuyDialogOpen] = useState(false);
	const [tradeSubmitting, setTradeSubmitting] = useState(false);
	const tradeMutation = useTradeMutation(userAddress ?? 'demo-wallet');

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

	const statItems = [
		{
			label: 'Current Price',
			value: formatDisplayKeyPrice(resolveCreatorKeyPriceStroops(creator)),
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
					<div className="min-w-0 flex-1">
						<CreatorProfileHeader
							name={creator.title}
							handle={creator.socialHandle || creator.instructorId}
							creatorId={creator.id}
							isVerified={creator.isVerified}
							avatarUrl={creator.thumbnail}
							bio={creator.description}
							priceStroops={resolveCreatorKeyPriceStroops(creator)}
							showBackButton={hasMounted}
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
						labelName={creator.title}
						className="mt-3 shrink-0"
					/>
				</div>
				<div data-testid="creator-stat-cards">
					<CreatorProfileStatRow items={statItems} />
				</div>
				<KeyStatsPanel
					stats={keyStats}
					isLoading={isKeyStatsLoading}
					isError={isKeyStatsError}
					uniqueTraders={uniqueTraders}
					isUniqueTradersLoading={isUniqueTradersLoading}
				/>
				<PerformanceBondPanel
					bond={performanceBond}
					isLoading={isPerformanceBondLoading}
					isError={isPerformanceBondError}
				/>
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
						<Button
							disabled={isKeyDeprecated(creator)}
							data-testid="key-detail-buy-button"
							onClick={() => setBuyDialogOpen(true)}
							variant={isKeyDeprecated(creator) ? 'outline' : 'default'}
							className="min-h-11 w-full rounded-xl font-bold sm:h-10 sm:min-h-0 sm:w-auto"
						>
							{isKeyDeprecated(creator) ? 'Buy Disabled (Deprecated)' : 'Buy Key'}
						</Button>
					</div>
				</div>
				{userAddress && (
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
				{isTwapLoading ? (
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
				) : null}
				<StakingRewardsSection {...stakingStats} isLoading={isLoading} />
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
				<KeySimulationTool
					currentSupply={creator.creatorShareSupply ?? 100}
					protocolFeeBps={creator.protocolFeeBps}
					creatorFeeBps={creator.creatorFeeBps}
				/>
				<div
					className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8"
					data-testid="holder-concentration-container"
				>
					<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
						Holder Concentration
					</h2>
					<HolderConcentrationChart
						holders={holders}
						totalSupply={creator.creatorShareSupply}
					/>
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
				<CoCreatorSection
					courseId={creator.id}
					coCreatorAddress={creator.coCreatorAddress}
					coCreatorSplitBps={creator.coCreatorSplitBps}
					totalPaidToCoCreator={creator.totalPaidToCoCreator}
					totalPaidToCreator={creator.totalPaidToCreator}
				/>
				<div
					data-testid="creator-holders-container"
					className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8"
				>
					<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
						Key Holders
					</h2>
					<KeyHolderList
						holders={holders}
						hasNextPage={hasNextPage}
						isFetchingNextPage={isFetchingNextPage}
						fetchNextPage={() => {
							void fetchNextPage();
						}}
					/>
				</div>
				<div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:p-8">
					<h2 className="font-grotesque text-xl font-black tracking-tight text-white mb-6">
						Activity
					</h2>
					<CreatorActivityFeed creatorId={creator.id} />
				</div>
				{isKeyDeprecated(creator) && (
					<KeyBuybackModal
						open={buybackModalOpen}
						onOpenChange={setBuybackModalOpen}
						creatorId={creator.id}
						creatorTitle={creator.title || creator.name || 'Creator Key'}
						holdingsCount={holdingsCount}
						buybackPriceStroops={
							resolveCreatorKeyPriceStroops(creator) ?? 0
						}
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
