use anchor_lang::prelude::*;

declare_id!("58a2h7zogfV5ZgUsfyr1DZ36j1bgcwfCkGvd8fwppy5x");

const DISPUTE_WINDOW_SECONDS: i64 = 3600;
const PLATFORM_FEE_BPS: u16 = 200;
const TRUSTLESS_OVERRIDE_TIMEOUT: i64 = 3600; // 1 jam — creator bisa resolve trustless market setelah oracle gagal

const TXLINE_TXORACLE_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

// ─── State ─────────────────────────────────────────────────────────

#[account]
pub struct Market {
    pub fixture_id: u64,
    pub question: String,          // max 200 chars
    pub creator: Pubkey,
    pub outcome_count: u8,         // 2 (YES/NO binary)
    pub question_type: u8,         // 0=home_win, 1=draw, 2=away_win
    pub total_pool: u64,
    pub pool_yes: u64,
    pub pool_no: u64,
    pub betting_open_time: i64,
    pub betting_close_time: i64,
    pub status: MarketStatus,
    pub winning_option: u8,        // 0=YES, 1=NO, 255=unset
    pub is_trustless: bool,        // true = TxLINE CPI settlement, false = manual creator resolve
    pub settlement_root: Pubkey,
    pub settlement_epoch_day: u16,
    pub settlement_ts: i64,
    pub dispute_until: i64,
    pub fee_bps: u16,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 8  // discriminator
        + 8   // fixture_id
        + 4 + 200 // question (4-byte len prefix + max 200 chars)
        + 32  // creator
        + 1   // outcome_count
        + 1   // question_type
        + 8   // total_pool
        + 8   // pool_yes
        + 8   // pool_no
        + 8   // betting_open_time
        + 8   // betting_close_time
        + 1   // status (enum discriminant)
        + 1   // winning_option
        + 1   // is_trustless
        + 32  // settlement_root
        + 2   // settlement_epoch_day
        + 8   // settlement_ts
        + 8   // dispute_until
        + 2   // fee_bps
        + 1;  // bump
}

#[account]
pub struct Bet {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub option_index: u8,          // 0=YES, 1=NO
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Bet {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum MarketStatus {
    Pending,
    Open,
    Closed,
    Settled,
    Cancelled,
}

// ─── TxLINE CPI Types ──────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

// ─── Events ────────────────────────────────────────────────────────

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub fixture_id: u64,
    pub creator: Pubkey,
    pub question: String,
    pub betting_close_time: i64,
    pub is_trustless: bool,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub option_index: u8,
    pub amount: u64,
    pub side: bool,
}

#[event]
pub struct MarketSettled {
    pub market: Pubkey,
    pub fixture_id: u64,
    pub winning_option: u8,
    pub winning_side: bool,
    pub settlement_root: Pubkey,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub outcome: bool,
}



#[event]
pub struct PayoutClaimed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
}

// ─── Error Codes ───────────────────────────────────────────────────

#[error_code]
pub enum FullTimeError {
    #[msg("Question too long (max 200 chars)")]
    QuestionTooLong,
    #[msg("Betting close time must be in the future")]
    BettingCloseTimeInPast,
    #[msg("Betting close time must be after open time")]
    InvalidBettingWindow,
    #[msg("Market not open")]
    MarketNotOpen,
    #[msg("Betting window is closed")]
    BettingClosed,
    #[msg("Invalid option (0=YES, 1=NO)")]
    InvalidOptionIndex,
    #[msg("Market must be Closed to settle/resolve")]
    MarketNotClosed,
    #[msg("Market already settled")]
    MarketAlreadySettled,
    #[msg("Invalid market status for this operation")]
    InvalidMarketStatus,
    #[msg("Claim not available")]
    ClaimNotAvailable,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Your bet is not the winning option")]
    NotWinner,
    #[msg("Only the market creator can perform this")]
    UnauthorizedCancel,
    #[msg("Merkle proof verification failed")]
    MerkleVerificationFailed,
    #[msg("Invalid stat value")]
    InvalidStatValue,
    #[msg("Bet amount must be > 0")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Invalid daily scores roots PDA")]
    InvalidDailyScoresRoots,
    #[msg("Only trustless markets can use TxLINE settlement")]
    NotTrustlessMarket,
    #[msg("Only manual markets can use resolve_market")]
    NotManualMarket,
    #[msg("Fixture ID required for trustless markets")]
    FixtureIdRequired,
    #[msg("Trustless market override: wait 1h after betting close")]
    ResolveTooEarly,
    #[msg("Invalid question type (must be 0=home_win, 1=draw, 2=away_win)")]
    InvalidQuestionType,
}

// ─── Contexts ──────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(fixture_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [
            b"market",
            crate::id().as_ref(),
            creator.key().as_ref(),
            &fixture_id.to_le_bytes(),
        ],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = bettor,
        space = Bet::LEN,
        seeds = [
            b"bet",
            market.key().as_ref(),
            bettor.key().as_ref(),
        ],
        bump,
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageMarket<'info> {
    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: PDA daily_scores_roots
    pub daily_scores_merkle_roots: AccountInfo<'info>,

    /// CHECK: TxLINE program for CPI
    #[account(address = TXLINE_TXORACLE_ID)]
    pub txline_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
        constraint = market.creator == creator.key() @ FullTimeError::UnauthorizedCancel,
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [
            b"bet",
            market.key().as_ref(),
            bettor.key().as_ref(),
        ],
        bump = bet.bump,
    )]
    pub bet: Account<'info, Bet>,
}

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
        constraint = market.creator == creator.key() @ FullTimeError::UnauthorizedCancel,
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct RefundBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        close = bettor,
        seeds = [
            b"bet",
            market.key().as_ref(),
            bettor.key().as_ref(),
        ],
        bump = bet.bump,
    )]
    pub bet: Account<'info, Bet>,
}

// ─── Core CPI Logic ────────────────────────────────────────────────

fn verify_stat<'info>(
    target_ts: i64,
    fixture_summary: &ScoresBatchSummary,
    fixture_proof: &[ProofNode],
    main_tree_proof: &[ProofNode],
    stat: &StatTerm,
    account_infos: &[AccountInfo<'info>],
) -> Result<()> {
    let predicate = TraderPredicate {
        threshold: -1,
        comparison: Comparison::GreaterThan,
    };

    let mut data = Vec::new();
    data.extend_from_slice(&VALIDATE_STAT_DISCRIMINATOR);
    data.extend_from_slice(&target_ts.to_le_bytes());

    let mut fsa = Vec::new();
    fixture_summary.serialize(&mut fsa)?;
    data.extend_from_slice(&fsa);

    let mut fpa = Vec::new();
    (fixture_proof.len() as u32).serialize(&mut fpa)?;
    for node in fixture_proof {
        node.serialize(&mut fpa)?;
    }
    data.extend_from_slice(&fpa);

    let mut mta = Vec::new();
    (main_tree_proof.len() as u32).serialize(&mut mta)?;
    for node in main_tree_proof {
        node.serialize(&mut mta)?;
    }
    data.extend_from_slice(&mta);

    predicate.serialize(&mut data)?;
    stat.serialize(&mut data)?;

    // stat_b = None
    data.push(0u8);
    // op = None
    data.push(0u8);

    let daily_meta = anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
        account_infos[0].key(),
        false,
    );

    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: TXLINE_TXORACLE_ID,
            accounts: vec![daily_meta],
            data,
        },
        account_infos,
    ).map_err(|_| error!(FullTimeError::MerkleVerificationFailed))?;

    Ok(())
}

// ─── Program ───────────────────────────────────────────────────────

#[program]
pub mod fulltime {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: u64,
        question: String,
        question_type: u8,
        betting_open_time: i64,
        betting_close_time: i64,
        is_trustless: bool,
    ) -> Result<()> {
        require!(
            question.len() <= 200,
            FullTimeError::QuestionTooLong
        );
        require!(
            question_type <= 2,
            FullTimeError::InvalidQuestionType
        );
        require!(
            betting_close_time > betting_open_time,
            FullTimeError::InvalidBettingWindow
        );
        let clock = Clock::get()?;
        require!(
            betting_open_time > clock.unix_timestamp,
            FullTimeError::BettingCloseTimeInPast
        );

        if is_trustless {
            require!(fixture_id > 0, FullTimeError::FixtureIdRequired);
        }

        let market = &mut ctx.accounts.market;
        market.fixture_id = fixture_id;
        market.question = question.clone();
        market.creator = ctx.accounts.creator.key();
        market.outcome_count = 2;
        market.question_type = question_type;
        market.total_pool = 0;
        market.pool_yes = 0;
        market.pool_no = 0;
        market.betting_open_time = betting_open_time;
        market.betting_close_time = betting_close_time;
        market.status = MarketStatus::Pending;
        market.winning_option = 255;
        market.is_trustless = is_trustless;
        market.settlement_root = Pubkey::default();
        market.settlement_epoch_day = 0;
        market.settlement_ts = 0;
        market.dispute_until = 0;
        market.fee_bps = PLATFORM_FEE_BPS;
        market.bump = ctx.bumps.market;

        emit!(MarketCreated {
            market: market.key(),
            fixture_id,
            creator: ctx.accounts.creator.key(),
            question,
            betting_close_time,
            is_trustless,
        });

        Ok(())
    }

    pub fn open_market(ctx: Context<ManageMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Pending, FullTimeError::InvalidMarketStatus);
        market.status = MarketStatus::Open;
        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        option_index: u8,
        amount: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bettor = &ctx.accounts.bettor;

        require!(market.status == MarketStatus::Open, FullTimeError::MarketNotOpen);
        require!(Clock::get()?.unix_timestamp < market.betting_close_time, FullTimeError::BettingClosed);
        require!(option_index < market.outcome_count, FullTimeError::InvalidOptionIndex);
        require!(amount > 0, FullTimeError::InsufficientFunds);

        // option_index: 0 = YES, 1 = NO
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: bettor.to_account_info(),
                    to: market.to_account_info(),
                },
            ),
            amount,
        )?;

        market.total_pool = market
            .total_pool
            .checked_add(amount)
            .ok_or(FullTimeError::MathOverflow)?;

        match option_index {
            0 => {
                market.pool_yes = market
                    .pool_yes
                    .checked_add(amount)
                    .ok_or(FullTimeError::MathOverflow)?;
            }
            1 => {
                market.pool_no = market
                    .pool_no
                    .checked_add(amount)
                    .ok_or(FullTimeError::MathOverflow)?;
            }
            _ => unreachable!(),
        }

        let bet = &mut ctx.accounts.bet;
        bet.market = market.key();
        bet.bettor = bettor.key();
        bet.option_index = option_index;
        bet.amount = amount;
        bet.claimed = false;
        bet.bump = ctx.bumps.bet;

        emit!(BetPlaced {
            market: market.key(),
            bettor: bettor.key(),
            option_index,
            amount,
            side: option_index == 0,
        });

        Ok(())
    }

    pub fn close_betting(ctx: Context<ManageMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, FullTimeError::InvalidMarketStatus);
        require!(Clock::get()?.unix_timestamp >= market.betting_close_time, FullTimeError::InvalidMarketStatus);
        market.status = MarketStatus::Closed;
        Ok(())
    }

    pub fn settle_market(
        ctx: Context<SettleMarket>,
        target_ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        stat_a: StatTerm,
        stat_b: StatTerm,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;

        require!(
            market.status == MarketStatus::Closed,
            FullTimeError::MarketNotClosed
        );

        require!(
            market.is_trustless,
            FullTimeError::NotTrustlessMarket
        );

        require!(
            fixture_summary.fixture_id as u64 == market.fixture_id,
            FullTimeError::MerkleVerificationFailed
        );

        let epoch_day = ((target_ts / 86400000) as u16).to_le_bytes();
        let (expected_pda, _bump) = Pubkey::find_program_address(
            &[b"daily_scores_roots", &epoch_day],
            &TXLINE_TXORACLE_ID,
        );
        require!(
            ctx.accounts.daily_scores_merkle_roots.key() == expected_pda,
            FullTimeError::InvalidDailyScoresRoots
        );

        let cpi_accounts = [
            ctx.accounts.daily_scores_merkle_roots.clone(),
            ctx.accounts.txline_program.clone(),
        ];

        verify_stat(
            target_ts,
            &fixture_summary,
            &fixture_proof,
            &main_tree_proof,
            &stat_a,
            &cpi_accounts,
        )?;

        verify_stat(
            target_ts,
            &fixture_summary,
            &fixture_proof,
            &main_tree_proof,
            &stat_b,
            &cpi_accounts,
        )?;

        let home_goals = stat_a.stat_to_prove.value;
        let away_goals = stat_b.stat_to_prove.value;

        require!(home_goals >= 0, FullTimeError::InvalidStatValue);
        require!(away_goals >= 0, FullTimeError::InvalidStatValue);

        let winning_option = match market.question_type {
            0 => if home_goals > away_goals { 0u8 } else { 1u8 },    // home_win
            1 => if home_goals == away_goals { 0u8 } else { 1u8 },   // draw
            2 => if home_goals < away_goals { 0u8 } else { 1u8 },    // away_win
            _ => return Err(FullTimeError::InvalidQuestionType.into()),
        };

        let now = Clock::get()?.unix_timestamp;
        market.status = MarketStatus::Settled;
        market.winning_option = winning_option;
        market.settlement_root = ctx.accounts.daily_scores_merkle_roots.key();
        market.settlement_epoch_day = (target_ts / 86400000) as u16;
        market.settlement_ts = now;
        market.dispute_until = now
            .checked_add(DISPUTE_WINDOW_SECONDS)
            .ok_or(FullTimeError::MathOverflow)?;

        emit!(MarketSettled {
            market: market.key(),
            fixture_id: market.fixture_id,
            winning_option,
            winning_side: winning_option == 0,
            settlement_root: ctx.accounts.daily_scores_merkle_roots.key(),
        });

        Ok(())
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        outcome: bool,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;

        require!(market.status == MarketStatus::Closed, FullTimeError::MarketNotClosed);

        if market.is_trustless {
            let now = Clock::get()?.unix_timestamp;
            require!(
                now >= market.betting_close_time
                    .checked_add(TRUSTLESS_OVERRIDE_TIMEOUT)
                    .ok_or(FullTimeError::MathOverflow)?,
                FullTimeError::ResolveTooEarly
            );
        }

        let now = Clock::get()?.unix_timestamp;
        market.status = MarketStatus::Settled;
        market.winning_option = if outcome { 0u8 } else { 1u8 };
        market.settlement_ts = now;
        market.dispute_until = now
            .checked_add(DISPUTE_WINDOW_SECONDS)
            .ok_or(FullTimeError::MathOverflow)?;

        emit!(MarketResolved {
            market: market.key(),
            creator: ctx.accounts.creator.key(),
            outcome,
        });

        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let bettor = &ctx.accounts.bettor;

        require!(market.status == MarketStatus::Settled, FullTimeError::ClaimNotAvailable);
        require!(!bet.claimed, FullTimeError::AlreadyClaimed);
        require!(bet.option_index == market.winning_option, FullTimeError::NotWinner);

        let winning_pool = match market.winning_option {
            0 => market.pool_yes,
            1 => market.pool_no,
            _ => return Err(FullTimeError::MathOverflow.into()),
        };

        if winning_pool == 0 {
            return Err(FullTimeError::InsufficientFunds.into());
        }

        let gross_payout = (bet.amount as u128)
            .checked_mul(market.total_pool as u128)
            .ok_or(FullTimeError::MathOverflow)?
            .checked_div(winning_pool as u128)
            .ok_or(FullTimeError::MathOverflow)?;

        let fee = gross_payout
            .checked_mul(market.fee_bps as u128)
            .ok_or(FullTimeError::MathOverflow)?
            .checked_div(10000u128)
            .ok_or(FullTimeError::MathOverflow)?;

        let net_payout = gross_payout
            .checked_sub(fee)
            .ok_or(FullTimeError::MathOverflow)? as u64;

        require!(net_payout > 0, FullTimeError::InsufficientFunds);

        **market.to_account_info().try_borrow_mut_lamports()? = market
            .to_account_info()
            .lamports()
            .checked_sub(net_payout)
            .ok_or(FullTimeError::MathOverflow)?;

        **bettor.to_account_info().try_borrow_mut_lamports()? = bettor
            .to_account_info()
            .lamports()
            .checked_add(net_payout)
            .ok_or(FullTimeError::MathOverflow)?;

        bet.claimed = true;

        emit!(PayoutClaimed {
            market: market.key(),
            bettor: bettor.key(),
            amount: net_payout,
        });

        Ok(())
    }

    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            market.status == MarketStatus::Closed
                || market.status == MarketStatus::Open
                || market.status == MarketStatus::Pending,
            FullTimeError::InvalidMarketStatus
        );
        market.status = MarketStatus::Cancelled;
        Ok(())
    }

    pub fn refund_bet(ctx: Context<RefundBet>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &ctx.accounts.bet;
        let bettor = &ctx.accounts.bettor;

        require!(market.status == MarketStatus::Cancelled, FullTimeError::InvalidMarketStatus);
        require!(!bet.claimed, FullTimeError::AlreadyClaimed);

        let amount = bet.amount;

        match bet.option_index {
            0 => market.pool_yes = market.pool_yes.checked_sub(amount).ok_or(FullTimeError::MathOverflow)?,
            1 => market.pool_no = market.pool_no.checked_sub(amount).ok_or(FullTimeError::MathOverflow)?,
            _ => return Err(FullTimeError::InvalidOptionIndex.into()),
        }
        market.total_pool = market.total_pool.checked_sub(amount).ok_or(FullTimeError::MathOverflow)?;

        **market.to_account_info().try_borrow_mut_lamports()? = market
            .to_account_info().lamports()
            .checked_sub(amount).ok_or(FullTimeError::MathOverflow)?;

        **bettor.to_account_info().try_borrow_mut_lamports()? = bettor
            .to_account_info().lamports()
            .checked_add(amount).ok_or(FullTimeError::MathOverflow)?;

        Ok(())
    }
}
