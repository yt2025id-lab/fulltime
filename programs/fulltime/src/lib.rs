use anchor_lang::prelude::*;

declare_id!("6AWLMoQ31mqSgNT4ttGvK347riXiBdqV7HutpCCZKkRa");

#[program]
pub mod fulltime {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
