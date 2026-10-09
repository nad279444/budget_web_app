import React from "react";

export const dynamic = "force-dynamic";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="container mx-auto my-32">{children}</div>;
};

export default MainLayout;