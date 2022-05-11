"""
This module contains code, constants, etc. to deal with pricing an application
and its dependencies.

Critically this encapsulates how we compute Flathub's share, and how we then
distribute the share among other parties.  This is to be considered canonical.
"""

# The currency Flathub operates in is US dollars (which for Stripe means cents)
from typing import List, Tuple

from .. import db as appdb
from ..utils import PLATFORMS

FLATHUB_CURRENCY = "usd"
# Our flat costs are 30¢ per transaction
FLATHUB_FIXED_COST = 30
# Our variable costs are 5% per transaction
FLATHUB_COST_SHARE = 0.05
# We'd prefer to receive 10% of the transaction to cover costs and provide some
# funding to cover hosting etc.
FLATHUB_PLATFORM_SHARE = 0.1


def flathub_fee(total: int, currency: str) -> int:
    """
    Compute the fee Flathub takes of the total which must be in
    the integral form of the Flathub currency.  For now this means USD and
    thus cents.

    The rule is we take the platform share, unless that's less than the fixed
    fees plus the cost share, in which case we take that.
    """

    if currency != FLATHUB_CURRENCY:
        raise ValueError(f"Currency '{currency}' is not supported")

    flat_rate = total * FLATHUB_PLATFORM_SHARE
    variable_rate = FLATHUB_FIXED_COST + (total * FLATHUB_COST_SHARE)

    return int(max(flat_rate, variable_rate) + 0.5)


def compute_shares(appid: str, appshare: int) -> List[Tuple[str, int]]:
    """
    Find the percentage shares for the platform(s) for the given app
    Where platforms are deps of deps, their shares are scaled appropriately

    This could raise:

    * ValueError if appid isn't found, or if the app references an unknown platform
    * ValueError if appshare is less than 10 or higher than 100
    * KeyError if the platform isn't known
    """
    if (app := appdb.get_json_key(f"apps:{appid}")) is None:
        raise ValueError(f"Unknown app: {appid}")
    if appshare < 10 or appshare > 100:
        raise ValueError(
            f"Application share of {appshare} is not between 10 and 100 percent"
        )
    remaining = 100 - appshare
    ret = [(appid, appshare)]
    platform = app.get("bundle", {}).get("runtime")
    while remaining > 0 and platform:
        if (slash := platform.find("/")) != -1:
            platform = platform[:slash]
        plaf = PLATFORMS[platform]
        share = int((remaining * plaf.keep) / 100)
        if share > 0:
            ret.append((platform, share))
        remaining = remaining - share
        platform = plaf.depends
    if remaining != 0:
        ret[0] = (appid, appshare + remaining)
    return ret


def compute_app_shares(
    total: int, currency: str, appid: str, appshare: int
) -> List[Tuple[str, int]]:
    """
    Compute the shares that the app, flathub, and any platform(s) take from
    the payment.

    If the total is too low, this could raise any of:

    * ValueError if currency not supported (USD for now)
    * ValueError if total too small (must be at least 1 USD for now)
    * ValueError if appid isn't found, or if the app references an unknown platform
    * ValueError if appshare is less than 10 or higher than 100
    * KeyError if the platform isn't known
    """
    if total < 100:
        raise ValueError(f"Transaction too small: {total}")
    fh_fee = flathub_fee(total, currency)
    remaining = total - fh_fee
    if appshare < 10 or appshare > 100:
        raise ValueError(
            f"Application share of {appshare} is not between 10 and 100 percent"
        )
    ret = []
    shares = compute_shares(appid, appshare)
    to_split = remaining
    while remaining > 0 and len(shares) > 0:
        (appid, share) = shares.pop(0)
        share = int(((to_split * share) / 100) + 0.5)
        ret.append((appid, share))
        remaining -= share
    if remaining != 0:
        # Apply adjustments to application fee
        ret[0] = (ret[0][0], ret[0][1] + remaining)
    ret.append(("org.flathub.Flathub", fh_fee))
    assert total == sum((fee for (_appid, fee) in ret))
    return ret
