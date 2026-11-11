import io

p = r'C:\Users\rene\5dev\apps\api\src\modules\ai\actions.ts'
s = io.open(p, encoding='utf-8').read()

# ---------------------------------------------------------------- 1. lecture
read_tool = r'''
  read_market: {
    label: 'Lire le catalogue des plateformes et leurs prix',
    schema: z.object({
      categorie: z.string().default('tous'),
      fournisseur: z.string().max(60).optional(),
      limite: z.coerce.number().int().min(1).max(60).default(20),
    }),
    run: async (p: Record<string, unknown>) => {
      const cat = String(p.categorie ?? 'tous').trim().toLowerCase();
      return all(
        `select category, provider, plan, price, currency, unit, source_kind, checked_at, url
           from market_offers
          where ($1 = 'tous' or category = $1)
            and ($2::text is null or provider ilike '%' || $2 || '%')
          order by category, provider, price nulls last
          limit $3`,
        [cat, p.fournisseur ? String(p.fournisseur) : null, Number(p.limite ?? 20)],
      );
    },
  },

'''
anchor = "  read_bookings: {"
assert anchor in s
s = s.replace(anchor, read_tool.lstrip('\n') + anchor, 1)

# ------------------------------------------------------------- 2. catalogue d'actions
specs = r'''
  market_set_price: {
    label: 'Enregistrer le prix d’une offre du marché',
    schema: z.object({
      fournisseur: z.string().min(2).max(60),
      offre: z.string().min(2).max(120),
      prix: z.coerce.number().min(0).max(100000).nullable(),
      devise: z.enum(['USD', 'EUR', 'CDF']).default('USD'),
      unite: z.string().max(20).default('/mois'),
    }),
    describe: (p: Record<string, unknown>) =>
      `Prix de « ${String(p.offre)} » chez ${String(p.fournisseur)} → ${p.prix === null ? 'non relevé' : `${p.prix} ${p.devise}`}`,
  },
  market_add_platform: {
    label: 'Ajouter une plateforme au catalogue du marché',
    schema: z.object({
      categorie: z.string().max(40),
      fournisseur: z.string().min(2).max(60),
      offre: z.string().min(2).max(120),
      details: z.string().max(300).default(''),
      prix: z.coerce.number().min(0).max(100000).nullable().default(null),
      devise: z.enum(['USD', 'EUR', 'CDF']).default('USD'),
      unite: z.string().max(20).default('/mois'),
      page: z.string().max(300).default(''),
    }),
    describe: (p: Record<string, unknown>) =>
      `Ajouter ${String(p.fournisseur)} (${String(p.offre)}) en catégorie ${String(p.categorie)}`,
  },
  market_scrape: {
    label: 'Relancer le relevé des prix d’une plateforme',
    schema: z.object({ fournisseur: z.string().min(2).max(60) }),
    describe: (p: Record<string, unknown>) => `Relever les prix de ${String(p.fournisseur)} sur son site`,
  },
'''
anchor2 = "  email_send: {"
assert anchor2 in s
s = s.replace(anchor2, specs.strip('\n') + '\n' + anchor2, 1)

# ------------------------------------------------------------------ 3. exécution
cases = r'''
    case 'market_set_price': {
      const p = params as { fournisseur: string; offre: string; prix: number | null; devise: string; unite: string };
      const existing = await one<{ id: string; price: string | null }>(
        'select id, price from market_offers where provider=$1 and plan=$2 limit 1',
        [p.fournisseur, p.offre],
      );
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Offre introuvable chez ce fournisseur.');

      await one(
        `update market_offers set price=$2, currency=$3, unit=$4,
                prev_price = case when price is distinct from $2 then price else prev_price end,
                updated_at=now()
          where id=$1`,
        [existing.id, p.prix, p.devise, p.unite],
      );
      if (Number(existing.price ?? -1) !== Number(p.prix ?? -1) && p.prix !== null) {
        await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
          existing.id,
          p.prix,
          p.devise,
        ]).catch(() => null);
      }
      return {
        summary: `Prix de « ${p.offre} » (${p.fournisseur}) mis à jour : ${p.prix === null ? 'non relevé' : `${p.prix} ${p.devise}`}.`,
        link: '/admin/marche',
      };
    }

    case 'market_add_platform': {
      const p = params as {
        categorie: string;
        fournisseur: string;
        offre: string;
        details: string;
        prix: number | null;
        devise: string;
        unite: string;
        page: string;
      };
      const allowed = [
        'gratuit', 'domaines', 'hebergement', 'vps', 'stockage-objet', 'images-cdn',
        'base-de-donnees', 'email', 'paas', 'dns', 'sauvegarde', 'autre',
      ];
      if (!allowed.includes(p.categorie)) {
        throw new AppError(422, 'VALIDATION', `Catégorie inconnue : ${p.categorie}.`);
      }
      await one(
        `insert into market_offers(category, provider, plan, specs, price, currency, unit, url, source_kind, checked_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,'manuel', now())
         on conflict (category, provider, plan) do update
           set specs=excluded.specs, price=excluded.price, currency=excluded.currency,
               unit=excluded.unit, url=excluded.url, updated_at=now()`,
        [p.categorie, p.fournisseur, p.offre, p.details, p.prix, p.devise, p.unite, p.page],
      );
      return {
        summary: `${p.fournisseur} ajouté au catalogue (${p.categorie}).`,
        link: '/admin/marche',
      };
    }

    case 'market_scrape': {
      const p = params as { fournisseur: string };
      const { scrapeOne } = await import('../market-scrape.js');
      const report = await scrapeOne(p.fournisseur);
      if (report.error) throw new AppError(502, 'SCRAPE', `${p.fournisseur} : ${report.error}`);
      return {
        summary: `Relevé ${p.fournisseur} : ${report.offers} offre(s) mise(s) à jour, ${report.rejected} prix rejeté(s) car absents de la page.`,
        link: '/admin/marche',
      };
    }
'''
anchor3 = "    case 'automation_delete': {"
assert anchor3 in s
s = s.replace(anchor3, cases.lstrip('\n') + '\n' + anchor3, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('outil + 3 actions marche ajoutes')
