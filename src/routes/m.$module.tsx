import { createFileRoute, notFound } from "@tanstack/react-router";
import { getModule } from "@/lib/modules";
import { ModulePage } from "@/components/ModulePage";
import { SourcingPage } from "@/components/SourcingPage";
import { StockPage } from "@/components/StockPage";
import { PackingPage } from "@/components/PackingPage";
import { QualityPage } from "@/components/QualityPage";
import { DemandPlan } from "@/components/DemandPlan";
import { TransportPage } from "@/components/TransportPage";
import { OpenPointsRegister } from "@/components/OpenPointsRegister";
import { ProcessFlowMap } from "@/components/ProcessFlowMap";
import { BusinessProfilePage } from "@/components/BusinessProfilePage";
import { ReportsSuite } from "@/components/ReportsSuite";
import { LedgersPage } from "@/components/LedgersPage";
import { ProductCatalogPage } from "@/components/ProductCatalogPage";

export const Route = createFileRoute("/m/$module")({
  loader: ({ params }) => {
    const m = getModule(params.module);
    if (!m) throw notFound();
    return { slug: m.slug, title: m.title, description: m.description };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} · Velaan Bay Trading House` : "Unavailable · Velaan Bay";
    const description = loaderData?.description ?? "Trading House module";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ModuleRoute,
});

function ModuleRoute() {
  const { slug } = Route.useLoaderData();
  const mod = getModule(slug);
  if (!mod) throw notFound();
  if (slug === "open-points") return <OpenPointsRegister />;
  if (slug === "flow-map") return <ProcessFlowMap />;
  if (slug === "business-profile") return <BusinessProfilePage mod={mod} />;
  if (slug === "workflow-reports") return <ReportsSuite mod={mod} />;
  if (slug === "financial-ledgers") return <LedgersPage mod={mod} />;
  if (slug === "ai-sourcing") return <SourcingPage mod={mod} />;
  if (["inventory", "stock-movements"].includes(slug)) return <StockPage key={slug} mod={mod} />;
  if (slug === "product-catalog" || slug === "catalog") return <ProductCatalogPage mod={mod} />;
  if (slug === "demand-plan") return <DemandPlan mod={mod} />;
  if (slug === "quality-check") return <QualityPage mod={mod} />;
  if (slug === "packing") return <PackingPage mod={mod} />;
  if (slug === "transport") return <TransportPage mod={mod} />;
  return <ModulePage key={slug} mod={mod} />;
}
