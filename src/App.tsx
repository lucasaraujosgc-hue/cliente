/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ClientLayout, AccountantLayout } from "./components/Layouts";
import { Login, AccountantLogin } from "./pages/Auth";
import { ClientDashboard } from "./pages/client/Dashboard";
import { ClientVault } from "./pages/client/Vault";
import { SetupProfile } from "./pages/client/SetupProfile";
import { AccountantDashboard } from "./pages/accountant/Dashboard";
import { ClientsList } from "./pages/accountant/ClientsList";
import { ClientDetail } from "./pages/accountant/ClientDetail";

export default function App() {
  return (
    // @ts-ignore
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/setup-profile" element={<SetupProfile />} />
          <Route path="/admin/login" element={<AccountantLogin />} />

          {/* Client Routes */}
          <Route element={<ClientLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ClientDashboard />} />
            <Route path="/vault" element={<ClientVault />} />
            <Route path="/uploads" element={<Navigate to="/vault" replace />} />
          </Route>

          {/* Accountant Routes */}
          <Route path="/admin" element={<AccountantLayout />}>
            <Route index element={<AccountantDashboard />} />
            <Route path="clients" element={<ClientsList />} />
            <Route path="client/:id" element={<ClientDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

