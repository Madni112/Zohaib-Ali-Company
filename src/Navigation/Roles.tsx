import { MdDashboard, MdReceipt, MdPeople, MdAdminPanelSettings, MdEmojiTransportation, MdEdit, MdInventory2, MdClass, MdAccountBox, MdCategory, MdStraighten, MdDomain, MdInventory, MdBadge, MdShoppingCart, MdLocationOn, MdLocalShipping, MdCompareArrows, MdFormatListBulleted, MdAccountTree, MdReceiptLong, MdAccountBalance, MdLaptop, MdLaptopChromebook, MdMan, MdRequestPage, MdOutlineRequestPage, MdPageview, MdSpaceDashboard, MdOutlineLaptop, MdTexture } from 'react-icons/md';
import Brands from '../pages/Administration/Brands';
import Dashboard from '../pages/Dashboard/Dashboard';
import NewInvoice from '../pages/Sales/Invoice/NewInvoice';
import SalesHistory from '../pages/Sales/Invoice/SalesHistory';
import PrintInvoice from '../pages/Sales/Invoice/PrintInvoice';
import AddCustomer from '../pages/Sales/Customers/AddCustomer';
import CustomerHistory from '../pages/Sales/Customers/CustomerHistory';
import AddSalesman from '../pages/Sales/Salesman/AddSalesman';
import SalesmanHistory from '../pages/Sales/Salesman/SalesmanHistory';
import AddCompany from '../pages/Administration/AddCompany';
import DeliveryChallanHistory from '../pages/Sales/Delivery Challan/DeliveryChallanHistory';
import AddDeliveryChallan from '../pages/Sales/Delivery Challan/AddDeliveryChallan';
import PrintChallan from '../pages/Sales/Delivery Challan/PrintChallan';
import SalesReturnList from '../pages/Sales/Sales Return/SalesReturnList';
import AddSalesReturn from '../pages/Sales/Sales Return/AddSalesReturn';
import PrintSalesReturn from '../pages/Sales/Sales Return/PrintSalesReturn';
import ProductList from '../pages/Administration/Products/ProductList';
import AddProduct from '../pages/Administration/Products/AddProduct';
import Categories from '../pages/Administration/Categories';
import UomManager from '../pages/Administration/UomManager';
import SurfaceFinish from '../pages/Administration/SurfaceFinish';
import LocationList from '../pages/Administration/Location/LocationList';
import AddLocation from '../pages/Administration/Location/AddLocation';
import TransportationList from '../pages/Administration/Transportation/TransportationList';
import AddTransportation from '../pages/Administration/Transportation/AddTransportation';
import StockTransferList from '../pages/Administration/Stock Transfer/StockTransferList';
import AddStockTransfer from '../pages/Administration/Stock Transfer/AddStockTransfer';
import ChartOfAccountList from '../pages/Registration/Chart of Account/ChartOfAccountList';
import AddChartOfAccount from '../pages/Registration/Chart of Account/AddChartOfAccount';
import VoucherList from '../pages/Registration/Vouchers/VoucherList';
import AddVoucher from '../pages/Registration/Vouchers/AddVoucher';
import BankAccountList from '../pages/Registration/Bank Account/BankAccountList';
import AddBank from '../pages/Registration/Bank Account/AddBankAccount';
import AddOpeningStock from '../pages/Registration/Opening Stock/AddOpeningStock';
import OpeningStockList from '../pages/Registration/Opening Stock/OpeningStockList';
import { Children, Component } from 'react';
import AddInvoiceReceipt from '../pages/Registration/Invoice Receipt/AddInvoiceReceipt';
import InvoiceReceiptList from '../pages/Registration/Invoice Receipt/InvoiceReceiptList';
import PrintInvoiceReceipt from '../pages/Registration/Invoice Receipt/PrintInvoiceReceipt';
import AddMultiInvoiceReceipt from '../pages/Registration/Multi Invoice Receipt/AddMultiInvoiceReceipt';
import AddPurchases from '../pages/Purchase/Purchase/AddPurchases';
import PurchaseList from '../pages/Purchase/Purchase/PurchaseList';
import PrintPurchase from '../pages/Purchase/Purchase/PrintPurchase';
import VendorList from '../pages/Purchase/Vendor/VendorList';
import AddVendor from '../pages/Purchase/Vendor/AddVendor';
import PurchaseReceiptList from '../pages/Purchase/Purchase Receipt/PurchaseReceiptList';
import AddPurchaseReceipt from '../pages/Purchase/Purchase Receipt/AddPurchaseReceipt';
import PrintPurchaseReceipt from '../pages/Purchase/Purchase Receipt/PrintPurchaseReceipt';
import PurchaseReturnList from '../pages/Purchase/Purchase Return/PurchaseReturnList';
import AddPurchaseReturn from '../pages/Purchase/Purchase Return/AddPurchaseReturn';
import PurchaseReturnReceiptList from '../pages/Purchase/Purchase Return Receipt/PurchaseReturnReceiptList';
import AddPurchaseReturnReceipt from '../pages/Purchase/Purchase Return Receipt/AddPurchaseReturnReceipt';
import ReportDashboard from '../pages/Reports/ReportDashboard';
import SalesReport from '../pages/Reports/Sales Report/SalesReport';
import PurchaseReport from '../pages/Reports/Purchase Report/PurchaseReports';
import StockReport from '../pages/Reports/Stock Report/StockReport';
import AccountReport from '../pages/Reports/Account Report/AccountReport';
import SaleReportPrint from '../pages/Reports/Sales Report/SaleReportPrint';
import SaleReturnReceiptList from '../pages/Sales/Sales Return Receipt/SaleReturnReceiptList';
import SaleReturnReceiptAdd from '../pages/Sales/Sales Return Receipt/SalesReturnReceiptAdd';
import PurchaseReportPrint from '../pages/Reports/Purchase Report/PurchaseReportPrint';
import StockReportPrint from '../pages/Reports/Stock Report/StockReportPrint';
import AccountReportPrint from '../pages/Reports/Account Report/AccountReportPrint';
import BalanceSheet from '../pages/Reports/BalanceSheet';

export const adminRoutes = [
  {
    path: '/',
    component: <Dashboard />,
    label: 'Dashboard',
    icon: MdDashboard,
  },
  {
    label: 'Administation',
    icon: MdAdminPanelSettings,
    children: [
      {
        path: '/Administration/Categories/List',
        component: <Categories />,
        label: 'Categories',
        icon: MdCategory
      },
      {
        path: '/Administration/Surface-Finish',
        component: <SurfaceFinish />,
        label: 'Surface Finish',
        icon: MdTexture
      },
      {
        path: '/Administration/UOM/List',
        component: <UomManager />,
        label: 'UOM',
        icon: MdStraighten
      },
      {
        path: '/Administration/Brands',
        component: <Brands />,
        label: 'Brands',
        icon: MdDomain
      },
      {
        label: 'Products',
        icon: MdDashboard,
        path: '/Administration/Products/List',
        component: <ProductList />,
      },
      {
        path: '/Administration/Locations/List',
        component: <LocationList />,
        label: 'Locations',
        icon: MdLocationOn
      },
      {
        path: '/Administration/Transportation/List',
        component: <TransportationList />,
        label: 'Transportation',
        icon: MdLocalShipping
      },
      {
        path: '/Administration/StockTransfer/List',
        component: <StockTransferList />,
        label: 'Stock Transfer',
        icon: MdCompareArrows
      },
      {
        path: '/company',
        component: <AddCompany />,
        label: 'Company',
        icon: MdAccountBox
      }
    ]
  },
  {
    label: 'REGISTRATION',
    icon: MdFormatListBulleted,
    children: [
      {
        path: '/Registration/Chart-of-Account/List',
        component: <ChartOfAccountList />,
        label: 'Chart Of Account',
        icon: MdAccountTree
      },
      {
        path: '/Registration/Vouchers/List',
        component: <VoucherList />,
        label: 'Vouchers',
        icon: MdReceiptLong
      },
      {
        path: '/Registration/Bank-Account/BankAccountList',
        component: <BankAccountList />,
        label: 'Bank Account',
        icon: MdAccountBalance
      },
      {
        path: '/Inventory/OpeningStock/List',
        component: <OpeningStockList />,
        label: 'Opening Stock',
        icon: MdInventory
      },
    ]
  },
  {
    label: 'Sales',
    icon: MdReceipt,
    children: [
      {
        label: 'Invoice',
        icon: MdReceipt,
        path: '/sales/invoice/list',
        component: <SalesHistory />
      },
      {
        path: '/Registration/InvoiceReceipt/List',
        component: <InvoiceReceiptList />,
        label: 'Invoice Receipt',
        icon: MdReceipt
      },
      {
        label: 'Sales Return',
        icon: MdEdit,
        path: '/Sales-Return/Debit-Notes/List',
        component: <SalesReturnList />,
      },
      {
        label: 'Sales Return Receipt',
        icon: MdEdit,
        path: '/sales/sales-return-receipt/list',
        component: <SaleReturnReceiptList />
      },
      {
        label: 'Customers',
        path: '/Customers/list',
        component: <CustomerHistory />,
        icon: MdPeople,
      },
      {
        label: 'Salesman',
        path: '/Salesman/list',
        component: <SalesmanHistory />,
        icon: MdPeople,
      },
      {
        label: 'Delivery Challan',
        path: '/Delivery-Challan/List',
        component: <DeliveryChallanHistory />,
        icon: MdEmojiTransportation,
      }
    ],
  },
  {
    label: 'Purchase',
    icon: MdLaptop,
    children: [
      {
        label: 'Purchases',
        path: '/Purchase/Purchases/List',
        component: <PurchaseList />,
        icon: MdLaptopChromebook
      },
      {
        label: 'Purchase Receipt',
        path: '/Purchase/Purchase-Receipt/List',
        component: <PurchaseReceiptList />,
        icon: MdOutlineLaptop
      },
      {
        label: 'Purchase Return',
        path: '/Purchase/Purchase-Return/List',
        component: <PurchaseReturnList />,
        icon: MdRequestPage
      },
      {
        label: 'Purchase Return Receipt',
        path: '/Purchase/Purchase-Return-Receipt/List',
        component: <PurchaseReturnReceiptList />,
        icon: MdOutlineRequestPage
      },
      {
        label: 'Vendor',
        path: '/Purchase/Vendor/List',
        component: <VendorList />,
        icon: MdMan
      }

    ]
  },
  {
    label: 'Reports',
    icon: MdPageview,
    children: [
      {
        label: 'Report Dashboard',
        path: '/Reports/Reports-Dashboard',
        component: <ReportDashboard />,
        icon: MdSpaceDashboard
      },
      {
        label: 'Sales Reports',
        path: '/Reports/Sales-Report',
        component: <SalesReport />,

      },
      {
        label: 'Purchase Reports',
        path: '/Reports/Purchase-Report',
        component: <PurchaseReport />,

      },
      {
        label: 'Stock Reports',
        path: '/Reports/Stock-Report',
        component: <StockReport />,

      },
      {
        label: 'Account Reports',
        path: '/Reports/Account-Report',
        component: <AccountReport />,

      },
      {
        label: 'Balance Sheet',
        path: '/Reports/Balance-Sheet',
        component: <BalanceSheet />,
        icon: MdAccountBalance
      }
    ]
  },
  {
    path: '/Administration/Products/Add',
    component: <AddProduct />,
    label: 'Add Product',
    hideFromSidebar: true
  },
  {
    path: '/Administration/Locations/Add',
    component: <AddLocation />,
    label: 'Add Location',
    hideFromSidebar: true
  },
  {
    path: '/Administration/Transportation/Add',
    component: <AddTransportation />,
    label: 'Add Transportation',
    hideFromSidebar: true
  },
  {
    path: '/Administration/StockTransfer/Add',
    component: <AddStockTransfer />,
    label: 'Add Stock Transfer',
    hideFromSidebar: true
  },
  {
    path: '/Registration/Chart-of-Account/Add',
    component: <AddChartOfAccount />,
    hideFromSidebar: true
  },
  {
    path: '/Registration/Vouchers/Add',
    component: <AddVoucher />,
    label: 'Add Voucher',
    hideFromSidebar: true
  },
  {
    path: '/Delivery-Challan/Print/:id',
    component: <PrintChallan />,
    label: 'Print Challan',
    hideFromSidebar: true
  },
  {
    path: '/Sales-Return/Debit-Notes/Print/:id',
    component: <PrintSalesReturn />,
    label: 'Print Voucher',
    hideFromSidebar: true
  },
  {
    path: '/sales/invoice/print/:id',
    component: <PrintInvoice />,
    label: 'Print Invoice',
    hideFromSidebar: true
  },
  {
    path: '/Registration/Bank-Account/AddBank',
    component: <AddBank />,
    hideFromSidebar: true
  },
  {
    path: '/Inventory/OpeningStock/Add',
    component: <AddOpeningStock />,
    label: 'Add Opening Stock',
    hideFromSidebar: true
  },
  {
    path: '/sales/invoice/add',
    component: <NewInvoice />,
    label: 'New Invoice',
    hideFromSidebar: true
  },
  {
    path: '/Sales-Return/Debit-Notes/Add',
    component: <AddSalesReturn />,
    hideFromSidebar: true
  },
  {
    path: '/Registration/InvoiceReceipt/Add',
    component: <AddInvoiceReceipt />,
    hideFromSidebar: true
  },
  {
    path: '/Customers/customer-details',
    component: <AddCustomer />,
    hideFromSidebar: true
  },
  {
    path: '/Salesman/add',
    component: <AddSalesman />,
    hideFromSidebar: true
  },
  {
    path: '/Delivery-Challan/Details',
    component: <AddDeliveryChallan />,
    hideFromSidebar: true
  },
  {
    path: '/Registration/MultiInvoiceReceipt/Add',
    component: <AddMultiInvoiceReceipt />,
    hideFromSidebar: true
  },
  {
    path: '/Purchase/Purchases/Add',
    component: <AddPurchases />,
    hideFromSidebar: true
  },
  {
    path: '/Purchase/Purchases/Print/:id',
    component: <PrintPurchase />,
    label: 'Print Purchase',
    hideFromSidebar: true
  },
  {
    path: '/purchase/purchases/print/:id',
    component: <PrintPurchase />,
    label: 'Print Purchase',
    hideFromSidebar: true
  },
  {
    path: '/Purchase/Vendor/Add',
    component: <AddVendor />,
    hideFromSidebar: true
  },
  {
    path: '/Purchase/Purchase-Receipt/Add',
    component: <AddPurchaseReceipt />,
    hideFromSidebar: true
  },
  {
    path: '/Purchase/Purchase-Return/Add',
    component: <AddPurchaseReturn />,
    hideFromSidebar: true
  },
  {
    path: '/Purchase/Purchase-Return-Receipt/Add',
    component: <AddPurchaseReturnReceipt />,
    hideFromSidebar: true
  },
  {
    path: '/Reports/Sales-Report/Print',
    component: <SaleReportPrint />,
    hideFromSidebar: true
  },
  {
    path: '/sales/sales-return-receipt/add',
    component: <SaleReturnReceiptAdd />,
    hideFromSidebar: true
  },
  {
    path: '/Reports/Purchase-Report/Print',
    component: <PurchaseReportPrint />,
    hideFromSidebar: true
  },
  {
    path: '/Reports/Stock-Report/Print',
    component: <StockReportPrint />,
    hideFromSidebar: true
  },
  {
    path: '/Reports/Account-Report/Print',
    component: <AccountReportPrint/>,
    hideFromSidebar: true
  },
  {
    path: '/Registration/InvoiceReceipt/Print/:id',
    component: <PrintInvoiceReceipt />,
    hideFromSidebar: true
  },
  {
    path: '/Purchase/Purchase-Receipt/Print/:id',
    component: <PrintPurchaseReceipt />,
    hideFromSidebar: true
  },
  {
    path: '/purchase/purchase-receipt/print/:id',
    component: <PrintPurchaseReceipt />,
    hideFromSidebar: true
  }
];
