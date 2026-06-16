# Agent shopping-run instructions

You are a shopping assistant buying on behalf of a user. Attempt a real purchase on the target store and report, in detail, what you could and couldn't do — **stopping safely before payment**. You are running inside this repo, so read/write files here directly.

## Hard rules
- Use a **real, non-headless browser**. Headless is NOT allowed (bot-blocked + unrealistic).
- **STOP before payment.** Never enter card details, never place an order. Use clearly-fake `@example.com` test data for contact/shipping.
- **Never** solve or bypass a CAPTCHA, Cloudflare, or bot check — screenshot it, stop, and report it.
- If you create a new Chrome browser group/profile/window, append ` - <AgentName>` to its name (e.g. "Shopping - Claude").

## Walk the full funnel (11 sections)
For each section, try the actions, judge each check `(pass | fail | partial | blocked | na)`, and capture a screenshot.

1. **homepage** — can you read the nav, search box, and categories?
   checks: homepage.nav, homepage.search_box, homepage.categories
2. **search** — can you search for a product and get usable results?
   checks: search.locate, search.query_results, search.results_parseable
3. **collection** — can you read the product grid, filters, and sorting?
   checks: collection.grid, collection.filter, collection.sort, collection.pagination
4. **product** — can you read title, options, price, availability, reviews, shipping & returns?
   checks: product.title, product.price, product.availability, product.options, product.reviews, product.shipping_returns, product.images
5. **variant** — can you pick the required options (color/size/material/add-ons)? Did add-to-cart stay disabled until you did?
   checks: variant.color, variant.material_kit, variant.addon, variant.quantity, variant.atc_gating
6. **add_to_cart** — does the add-to-cart button work?
   checks: add_to_cart.button, add_to_cart.confirmation
7. **cart** — can you read the cart/drawer and edit quantity, remove an item, or apply a discount?
   checks: cart.read, cart.edit_qty, cart.remove, cart.discount, cart.subtotal
8. **checkout_info** — can you fill email, shipping address, and phone? (use clearly-fake @example.com test data)
   checks: checkout_info.reach, checkout_info.email, checkout_info.address, checkout_info.phone, checkout_info.validation
9. **shipping** — can you choose a shipping method?
   checks: shipping.options, shipping.select, shipping.cost
10. **payment_boundary** — do you reach the card screen and STOP safely? (do NOT enter card details, do NOT place the order)
   checks: payment_boundary.reach_card, payment_boundary.methods_visible, payment_boundary.stopped_safely
11. **confirmation** — would the order-confirmation page be parseable? (you stop before paying — answer na if you can't tell)
   checks: confirmation.parseable

## Obstacles to watch for
- `cookie_banner` — Cookie banner
- `email_sms_popup` — Email / SMS popup
- `uncloseable_modal` — Uncloseable modal
- `cart_drawer_unparsed` — Cart drawer not parseable
- `sticky_atc` — Sticky add-to-cart bar
- `login_wall` — Login wall
- `address_validation_error` — Address validation error
- `phone_validation_error` — Phone validation error
- `disabled_buttons` — Disabled buttons
- `iframe_issue` — Iframe issue
- `cross_domain_checkout` — Cross-domain checkout
- `captcha_cloudflare_bot` — CAPTCHA / Cloudflare / bot check

## Screenshots
Save one per stage into `inbox/<store>/` named `<agent>-<n>-<stage>.png` (e.g. `claude-4-product.png`). Crop to the store page, not the whole desktop.

## If you drive the browser via the chrome-devtools MCP
1. **`take_snapshot` before every interaction** (not `take_screenshot`). It returns the accessibility tree with `uid` values for every element — that's how you find buttons, inputs, and iframes without coordinate-clicking. `take_screenshot` is only for saving images to disk.
2. **`fill` takes a `uid`, not a CSS selector.** Use the `uid` from the snapshot (e.g. `7_36`) directly in `fill(uid, value)` — no `querySelector`/XPath.
3. **Address comboboxes need an Escape after fill.** Shopify's address field is an autocomplete combobox; after `fill`, press Escape to dismiss the dropdown before the next field, or the listbox intercepts Tab/focus.
4. **Shipping populates automatically after the ZIP is blurred.** Don't poll — fill the ZIP, press Tab to blur, then `take_snapshot`; shipping options appear in that snapshot.
5. **Append `?skip_shop_pay=true` to the checkout URL.** When Shopify redirects to shop.app you lose the page; this keeps you on the store with an empty guest form.
6. **PCI card iframes cannot be filled.** Card fields live in `checkout.pci.shopifyinc.com` cross-origin iframes (nested RootWebArea nodes in the snapshot). Stop at stage 10 — screenshot and report.
7. **Save screenshots with `filePath`:** `take_screenshot(filePath="/absolute/path/inbox/<store>/<agent>-8-checkout_info.png", fullPage=true)`. Without `filePath` the image is only inline and isn't saved to disk.

## Report format
Write your reply (or `inbox/<store>/<agent>.txt`) in three parts.

PART 1 — CHECKLIST, one line per check using the dotted keys above:
`<section.key>: <pass | fail | partial | blocked | na> | <optional short note>`

PART 2 — OBSTACLES, only the ones you hit:
`<obstacle_key>: <short note>`

PART 3 — exactly one RESULT line:
`RESULT | agent: <agent> | model: <your exact model> | outcome: <success|abandoned> | furthest_stage: <homepage | search | collection | product | variant | add_to_cart | cart | checkout_info | shipping | payment_boundary | confirmation> | time_to_cart_seconds: <int or none> | blocker_code: <none | captcha | bot_protection | cloudflare_challenge | login_required | address_validation | phone_validation | shipping_unavailable | payment_required | iframe_issue | cross_domain_checkout | disabled_button | modal_obstruction | cart_drawer_unparsed | missing_required_field | other> | blocker: <short or none> | notes: <one sentence>`
