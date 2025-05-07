import '../styles/globals.css';
import { NextUIProvider } from '@nextui-org/react';
import { Provider } from 'react-redux';
import { store } from '../store';
import Navbar from '../components/Navbar';

const theme = {
    type: 'light',
    theme: {
        colors: {
            primary: '#007bff',
            secondary: '#6c757d',
            error: '#dc3545'
        }
    }
};

function MyApp({ Component, pageProps }) {
    return (
        <Provider store={store}>
            <NextUIProvider theme={theme}>
                <Navbar />
                <div className="content">
                    <Component {...pageProps} />
                </div>
                <style jsx global>{`
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
                            Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    }

                    .content {
                        margin-top: 80px;
                        padding: 1rem;
                    }

                    * {
                        box-sizing: border-box;
                    }
                `}</style>
            </NextUIProvider>
        </Provider>
    );
}

export default MyApp; 