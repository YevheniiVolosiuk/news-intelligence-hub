import FeedsOverview from '@/components/dashboard/feeds-overview';
import {ExampleSection} from '@/components/dashboard/page-body';
import StatisticsBlock from '@/components/shadcn-space/blocks/dashboard-shell-01/statistics';
import SalesOverviewChart from '@/components/shadcn-space/blocks/dashboard-shell-01/sales-overview-chart';
import EarningReportChart from '@/components/shadcn-space/blocks/dashboard-shell-01/earning-report-chart';
import TopProductTable from '@/components/shadcn-space/blocks/dashboard-shell-01/top-product-table';
import SalesByCountryWidget from '@/components/shadcn-space/blocks/dashboard-shell-01/salesbycountrywidget';

/**
 * Dashboard overview body. The real feature (Feeds overview) sits at the top;
 * the original dashboard-shell widgets stay below, clearly fenced off as mock
 * examples until they're replaced or removed.
 *
 * The widgets below are INTENTIONAL placeholder examples on mock data — not
 * shipped features and not dead code to strip. See the blocks README:
 * components/shadcn-space/blocks/dashboard-shell-01/README.md
 */
export default function DashboardOverview() {
  return (
    <div className="flex flex-col gap-10">
      {/* ----------------------------- Real data ----------------------------- */}
      <FeedsOverview />

      {/* ------------------------- Mock / examples --------------------------- */}
      <ExampleSection
        title="Analytics widgets"
        description="From the dashboard-shell template — sample charts and tables on mock data, kept for reference."
      >
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            <StatisticsBlock />
          </div>
          <div className="xl:col-span-8 col-span-12">
            <SalesOverviewChart />
          </div>
          <div className="xl:col-span-4 col-span-12">
            <EarningReportChart />
          </div>
          <div className="xl:col-span-8 col-span-12">
            <TopProductTable />
          </div>
          <div className="xl:col-span-4 col-span-12">
            <SalesByCountryWidget />
          </div>
        </div>
      </ExampleSection>
    </div>
  );
}
