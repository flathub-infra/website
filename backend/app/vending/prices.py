"""
This module contains code, constants, etc. to deal with pricing an application
and its dependencies.

Critically this encapsulates how we compute Flathub's share, and how we then
distribute the share among other parties.  This is to be considered canonical.
"""

# The currency Flathub operates in is US dollars (which for Stripe means cents)

from fastapi import HTTPException

from .. import db as appdb
from ..utils import PLATFORMS

FLATHUB_CURRENCY = "usd"
# Our flat costs are 30¢ per transaction
FLATHUB_FIXED_COST = 30
# Our variable costs are 5% per transaction
FLATHUB_COST_SHARE = 5
# We'd prefer to receive 10% of the transaction to cover costs and provide some
# funding to cover hosting etc.
FLATHUB_PLATFORM_SHARE = 10

# Taxing is done in a number of ways, these are the tax categories we assign
# to rows in orders
STRIPE_TAX_CATEGORIES = {
    # A monetary donation for a cause, in which the donee receives nothing in return.
    "DONATION": "txcd_90000001",
    # An online service that allows a customer to create, transform, process,
    # or access data electronically.
    "PROCESSING": "txcd_10701300",
    # Electronic software documentation or user manuals
    # For prewritten software & delivered electronically.
    "SOFTWARE": "txcd_10504003",
    # Video or electronic games in the common sense that are transferred electronically.
    # These goods are downloaded to a device with permanent access granted.
    "GAME": "txcd_10201000",
    # General - Electronically Supplied Services
    "GENERAL": "txcd_10000000",
}


def flathub_fee_parameters(currency: str) -> tuple[int, int, int]:
    """
    Compute the flathub fee parameters for a given currency.
    Raises ValueError if that currency isn't US dollars

    The returned tuple is of the form:

    (Fixed Cost, Cost share percentage, Platform share percentage)

    Where the computation of the flathub fee would be the fixed cost plus
    the total multiplied by the cost share percentage, or the total multiplied
    by the platform share percentage; whichever is larger.

    As an example, you may get (30, 5, 10) for US dollars, to mean that the
    fee is 30 cents plus five percent of the total; or else ten percent of the
    total whichever is larger.
    """
    if currency != FLATHUB_CURRENCY:
        raise ValueError(f"Currency '{currency}' is not supported")
    return (FLATHUB_FIXED_COST, FLATHUB_COST_SHARE, FLATHUB_PLATFORM_SHARE)


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

    flat_rate = int((total * FLATHUB_PLATFORM_SHARE) / 100)
    variable_rate = FLATHUB_FIXED_COST + int((total * FLATHUB_COST_SHARE) / 100)

    return int(max(flat_rate, variable_rate) + 0.5)


def compute_shares(appid: str, appshare: int) -> list[tuple[str, int]]:
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
) -> list[tuple[str, int]]:
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
    assert total == sum(fee for (_appid, fee) in ret)
    return ret


def stripe_tax_code_for(row):
    """
    Compute the tax code for the given transaction row.
    We mostly care about the row.recipient and row.kind as we care about
    donation vs. purchase and who it's for.
    """
    from ..vending import app_info

    try:
        info = app_info(row.recipient)
        if row.kind == "donation":
            return STRIPE_TAX_CATEGORIES["DONATION"]
        if info.kind == "GAME":
            return STRIPE_TAX_CATEGORIES["GAME"]
        return STRIPE_TAX_CATEGORIES["SOFTWARE"]
    except HTTPException:
        # We couldn't use app info, so assume it's for a platform or for
        # Flathub
        if row.kind != "donation":
            return STRIPE_TAX_CATEGORIES["GENERAL"]
        if row.recipient == "org.flathub.Flathub":
            return STRIPE_TAX_CATEGORIES["PROCESSING"]
        return STRIPE_TAX_CATEGORIES["SOFTWARE"]
