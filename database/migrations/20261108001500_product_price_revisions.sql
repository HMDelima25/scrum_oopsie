-- migrate:up
CREATE TABLE price_change(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),prodcode varchar(6) NOT NULL REFERENCES product(prodcode),
 effdate date NOT NULL,unitprice numeric(10,2),changed_at timestamptz,changed_by text NOT NULL,
 change_kind text NOT NULL CHECK(change_kind IN ('initial','change','inactive','restore'))
);
CREATE INDEX price_change_product ON price_change(prodcode,changed_at DESC,effdate DESC);
ALTER TABLE price_change ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON price_change FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON price_change TO service_role;
INSERT INTO price_change(prodcode,effdate,unitprice,changed_at,changed_by,change_kind) SELECT prodcode,effdate,unitprice,NULL,'existing-price-history','initial' FROM pricehist;
CREATE FUNCTION hope_price_change_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Price revision history is append-only'; END $$;
CREATE TRIGGER price_change_immutable BEFORE UPDATE OR DELETE ON price_change FOR EACH ROW EXECUTE FUNCTION hope_price_change_immutable();
CREATE FUNCTION hope_capture_price_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.unitprice IS DISTINCT FROM OLD.unitprice OR NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
  PERFORM 1 FROM product WHERE prodcode=NEW.prodcode FOR UPDATE;
  INSERT INTO price_change(prodcode,effdate,unitprice,changed_at,changed_by,change_kind) VALUES(NEW.prodcode,NEW.effdate,NEW.unitprice,clock_timestamp(),audit_user(),CASE WHEN NEW.is_deleted THEN 'inactive' WHEN TG_OP='INSERT' THEN CASE WHEN EXISTS(SELECT 1 FROM price_change WHERE prodcode=NEW.prodcode) THEN 'change' ELSE 'initial' END WHEN OLD.is_deleted THEN 'restore' ELSE 'change' END);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pricehist_revision AFTER INSERT OR UPDATE ON pricehist FOR EACH ROW EXECUTE FUNCTION hope_capture_price_change();
CREATE OR REPLACE VIEW product_current_price WITH (security_invoker=true) AS
 SELECT p.prodcode,p.description,p.unit,p.is_deleted,p.stamp,ph.unitprice,ph.effdate FROM product p
 LEFT JOIN LATERAL(SELECT unitprice,effdate FROM pricehist ph WHERE ph.prodcode=p.prodcode AND NOT ph.is_deleted AND ph.effdate<=(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date ORDER BY effdate DESC LIMIT 1) ph ON true WHERE NOT p.is_deleted;
-- Preserve the price charged on existing and new sale lines.
ALTER TABLE salesdetail ADD COLUMN captured_unitprice numeric(10,2);
UPDATE salesdetail d SET captured_unitprice=(SELECT ph.unitprice FROM pricehist ph JOIN sales s ON s.transno=d.transno WHERE ph.prodcode=d.prodcode AND NOT ph.is_deleted AND ph.effdate<=s.salesdate ORDER BY ph.effdate DESC LIMIT 1);
CREATE FUNCTION hope_capture_sale_price() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 SELECT ph.unitprice INTO NEW.captured_unitprice FROM pricehist ph JOIN sales s ON s.transno=NEW.transno WHERE ph.prodcode=NEW.prodcode AND NOT ph.is_deleted AND ph.effdate<=s.salesdate ORDER BY ph.effdate DESC LIMIT 1;
 RETURN NEW;
END $$;
CREATE TRIGGER salesdetail_capture_price BEFORE INSERT ON salesdetail FOR EACH ROW EXECUTE FUNCTION hope_capture_sale_price();
CREATE OR REPLACE VIEW sales_line_value WITH (security_invoker=true) AS
 SELECT d.transno,d.prodcode,d.quantity,s.salesdate,s.custno,s.empno,coalesce(d.captured_unitprice,p.unitprice) unitprice,round(d.quantity*coalesce(d.captured_unitprice,p.unitprice),2) line_total
 FROM salesdetail d JOIN sales s USING(transno)
 LEFT JOIN LATERAL(SELECT unitprice FROM pricehist ph WHERE ph.prodcode=d.prodcode AND ph.effdate<=s.salesdate AND NOT ph.is_deleted ORDER BY ph.effdate DESC LIMIT 1) p ON true WHERE NOT d.is_deleted AND NOT s.is_deleted;
CREATE FUNCTION hope_product_price_history(p_actor uuid,p_code text) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; item product; result jsonb;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted;
 IF NOT FOUND OR (actor.role<>'superadmin' AND coalesce(actor.rights->>'products.view','false')<>'true') THEN RAISE EXCEPTION 'Product access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM product WHERE prodcode=p_code;
 IF NOT FOUND OR (item.is_deleted AND actor.role='user') THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
 SELECT jsonb_build_object('current_price',(SELECT unitprice FROM product_current_price WHERE prodcode=p_code),'price_effective_date',(SELECT effdate FROM product_current_price WHERE prodcode=p_code),
 'version',(SELECT id FROM price_change WHERE prodcode=p_code ORDER BY changed_at DESC NULLS LAST,effdate DESC,id LIMIT 1),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY changed_at DESC NULLS LAST,effdate DESC,id),'[]'::jsonb) FROM (SELECT id,effdate,unitprice,changed_at,change_kind FROM price_change WHERE prodcode=p_code) x)) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION hope_update_product_price(p_actor uuid,p_code text,p_price numeric,p_expected uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; item product; current_version uuid; today date:=(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date; current_price numeric;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR (actor.role<>'superadmin' AND (coalesce(actor.rights->>'products.view','false')<>'true' OR coalesce(actor.rights->>'products.priceAdd','false')<>'true' OR coalesce(actor.rights->>'products.priceEdit','false')<>'true')) THEN RAISE EXCEPTION 'Price add and edit permissions required' USING ERRCODE='42501'; END IF;
 IF p_price IS NULL OR p_price<=0 OR p_price<>round(p_price,2) THEN RAISE EXCEPTION 'Enter a positive price with up to two decimal places'; END IF;
 LOCK TABLE pricehist IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO item FROM product WHERE prodcode=p_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
 IF item.is_deleted THEN RAISE EXCEPTION 'Restore the product before updating its price'; END IF;
 SELECT id INTO current_version FROM price_change WHERE prodcode=p_code ORDER BY changed_at DESC NULLS LAST,effdate DESC,id LIMIT 1;
 IF current_version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Prices changed elsewhere. Reopen this product before saving.' USING ERRCODE='40001'; END IF;
 SELECT unitprice INTO current_price FROM product_current_price WHERE prodcode=p_code;
 IF current_price=p_price THEN RAISE EXCEPTION 'Enter a different price'; END IF;
 -- Imported sale lines may predate their price records; freeze their old valuation now.
 UPDATE salesdetail d SET captured_unitprice=(SELECT ph.unitprice FROM pricehist ph JOIN sales s ON s.transno=d.transno WHERE ph.prodcode=d.prodcode AND NOT ph.is_deleted AND ph.effdate<=s.salesdate ORDER BY ph.effdate DESC LIMIT 1) WHERE d.prodcode=p_code AND d.captured_unitprice IS NULL;
 IF EXISTS(SELECT 1 FROM pricehist WHERE prodcode=p_code AND effdate=today) THEN
  PERFORM hope_mutate(p_actor,'pricehist','update',jsonb_build_object('prodcode',p_code,'effdate',today),jsonb_build_object('unitprice',p_price,'is_deleted',false));
 ELSE
  PERFORM hope_mutate(p_actor,'pricehist','insert','{}',jsonb_build_object('prodcode',p_code,'effdate',today,'unitprice',p_price));
 END IF;
 RETURN hope_product_price_history(p_actor,p_code);
END $$;
REVOKE ALL ON FUNCTION hope_price_change_immutable(),hope_capture_price_change(),hope_capture_sale_price(),hope_product_price_history(uuid,text),hope_update_product_price(uuid,text,numeric,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_price_change_immutable(),hope_capture_price_change(),hope_capture_sale_price(),hope_product_price_history(uuid,text),hope_update_product_price(uuid,text,numeric,uuid) TO service_role;
INSERT INTO app_migration(version) VALUES('202611080015_product_price_revisions');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
