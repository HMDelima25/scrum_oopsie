# Product popup price updates

Opening a product shows Overview and Price history tabs. Overview displays the current price and effective date. Update price opens a compact New price form. Save price publishes the change effective today in the Philippines, refreshes the product/table price, and returns to the popup's Price history tab. The action requires Product view, Price add and Price edit permissions and is unavailable for inactive products.

Each saved change is retained in an append-only revision table, including multiple changes on the same day. The existing daily price table remains compatible with the main Price history page and existing reports. Its daily snapshot is updated, while the popup revision tab preserves intermediate prices. Existing prices are imported into revision history without inventing past edit timestamps; those rows display Existing record. New changes display their actual Philippine date/time and change type.

The server validates positive prices with at most two decimal places and rejects unchanged amounts. A snapshot version prevents stale forms overwriting intervening changes, including changes made through the existing price table routes. Archived products cannot be repriced. Anonymous clients cannot read revision data or execute the privileged functions.

Existing sale lines retain their known charged price, and new sale lines capture the price applicable on their sale date. Publishing a new product price therefore does not revalue earlier priced sales. Imported lines lacking a price snapshot are resolved from their prior historical valuation before the new price is published. Price history remains compatible with future effective entries, which do not become current early.

Endpoints: GET `/api/products/:code/price-history` returns current_price, price_effective_date, version and history. POST `/api/products/:code/price` accepts `{unitprice,version}`. Historical revisions are immutable; source price-record inactivation/restoration is recorded as another history event.

The inactivation confirmation also uses themed compact tables: one section per related table, record-count headers, and separate columns for composite keys. It uses one body scrolling area and keeps its confirmation action visible; no comma-separated ID paragraphs remain.

Migration `20261108001500_product_price_revisions.sql` adds revision storage and sale-price snapshots. The suite passes 152 checks, including same-day revisions, stale versions, permissions, future prices, archived products, immutable history and prior/new sale amounts. Browser checks verified two saved revisions, updated Overview, the separate history tab, a 16-record inactivation preview, and mobile fit at 390x650. All price write tests used an isolated database.

Live verification imported all 84 existing price records into revision history and confirmed all 124 existing active sale balances were unchanged by the migration. Anonymous access to revision history is denied.
