import React, { useEffect } from 'react';
import { Route, Routes, useLocation, Navigate, useParams } from 'react-router-dom';
import Loader from '../common/Loader';
import SignIn from '../pages/Authentication/SignIn';
import DeveloperDashboard from '../pages/Developer/DeveloperDashboard';
import DefaultLayout from '../layout/DefaultLayout';
import Dashboard from '../pages/Dashboard/Dashboard';
import NotFound from '../pages/Error/NotFound';
import { useAuth } from '../Context/Auth';

/**
 * Universal Route Guard for all ERP Sub-pages
 */
const AppRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  // Auto-correct any corrupt nested prefixes (e.g. /purchase/Reports/Reports-Dashboard -> /Reports/Reports-Dashboard)
  const segments = pathname.split('/').filter(Boolean);
  const reservedPrefixes = ['purchase', 'sales', 'reports', 'registration', 'administration', 'dashboard', 'sales-return'];
  if (segments.length >= 2 && reservedPrefixes.includes(segments[0].toLowerCase()) && reservedPrefixes.includes(segments[1].toLowerCase())) {
    const cleanPath = `/${segments.slice(1).join('/')}`;
    return <Navigate to={cleanPath} replace />;
  }

  return <>{children}</>;
};

function Navigation() {
  const { pathname } = useLocation();
  const { isAuthenticated, getRoleBasedRoutes, loading: authLoading } = useAuth();

  const roleRoutes = getRoleBasedRoutes();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (authLoading) {
    return <Loader />;
  }

  const renderRoutes = (routes: any[]): any => {
    return routes.flatMap((route, index) => {
      const flat: any[] = [];

      if (route.path && route.component) {
        const cleanSub = route.path.replace(/^\//, '');

        // 1. Direct standard ERP route
        flat.push(
          <Route
            key={`direct-${index}-${route.path}`}
            path={route.path}
            element={
              <AppRouteGuard>
                <DefaultLayout>{route.component}</DefaultLayout>
              </AppRouteGuard>
            }
          />
        );

        // 2. Legacy tenant-prefixed route fallback (e.g. /bashir/sales/invoice/list -> same component)
        if (cleanSub) {
          flat.push(
            <Route
              key={`tenant-${index}-${route.path}`}
              path={`/:tenantPath/${cleanSub}`}
              element={
                <AppRouteGuard>
                  <DefaultLayout>{route.component}</DefaultLayout>
                </AppRouteGuard>
              }
            />
          );
        }
      }

      if (route.children) {
        flat.push(...renderRoutes(route.children));
      }

      return flat;
    });
  };

  return (
    <Routes>
      {/* 1. ROOT PORTAL URL: Authenticated -> Dashboard, Unauthenticated -> Single Universal SignIn */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <DefaultLayout>
              <Dashboard />
            </DefaultLayout>
          ) : (
            <SignIn />
          )
        }
      />

      {/* 2. UNIVERSAL SIGN-IN & LOGIN ROUTES */}
      <Route
        path="/signin"
        element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
      />

      {/* 3. SUPER ADMIN & EMPLOYEE ROLE MANAGEMENT CONSOLE */}
      <Route path="/dev/master" element={<DeveloperDashboard />} />
      <Route path="/Administration/Roles" element={<DeveloperDashboard />} />
      <Route path="/Administration/Users" element={<DeveloperDashboard />} />

      {/* 4. ALL DYNAMIC ROLE-BASED ERP MODULE ROUTES */}
      {renderRoutes(roleRoutes)}

      {/* 5. LEGACY TENANT GATE REDIRECTS (Gracefully redirects any old links) */}
      <Route path="/:tenantPath/signin" element={<Navigate to="/signin" replace />} />
      <Route path="/:tenantPath/login" element={<Navigate to="/signin" replace />} />
      <Route
        path="/:tenantPath"
        element={
          isAuthenticated ? (
            <DefaultLayout>
              <Dashboard />
            </DefaultLayout>
          ) : (
            <SignIn />
          )
        }
      />

      {/* 6. 404 NOT FOUND */}
      <Route
        path="*"
        element={
          <NotFound
            title="404 - Page Not Found"
            message="The requested page could not be found."
          />
        }
      />
    </Routes>
  );
}

export default Navigation;
