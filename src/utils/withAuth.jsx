import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom"

const withAuth = (WrappedComponent) => {
    const AuthComponent = (props) => {
        const router = useNavigate();

        const isAuthenticated = useCallback(() => {
            return !!localStorage.getItem("token");
        }, []);

        useEffect(() => {
            if (!isAuthenticated()) {
                router("/auth");
            }
        }, [isAuthenticated, router]); // FIX: router and isAuthenticated now listed as deps

        return <WrappedComponent {...props} />;
    };

    return AuthComponent;
};

export default withAuth;
