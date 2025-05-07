import { useRouter } from 'next/router';
import { FaBitcoin, FaChartLine, FaCog } from 'react-icons/fa';
import PriceChart from '../components/PriceChart';
import styles from '../styles/Home.module.css';

export default function Home() {
    const router = useRouter();

    const features = [
        {
            title: 'Дашборды',
            description: 'Создавайте и настраивайте дашборды для отслеживания криптовалют',
            icon: <FaChartLine className={styles.icon} />,
            path: '/dashboard'
        },
        {
            title: 'Избранное',
            description: 'Добавляйте криптовалюты в избранное для быстрого доступа',
            icon: <FaBitcoin className={styles.icon} />,
            path: '/watchlist'
        }
    ];

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1 className={styles.title}>
                    Добро пожаловать в CryptoAnalytics
                </h1>
                <p className={styles.description}>
                    Платформа для анализа и отслеживания криптовалют
                </p>
                <div className={styles.grid}>
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={styles.card}
                            onClick={() => router.push(feature.path)}
                        >
                            {feature.icon}
                            <h2>{feature.title}</h2>
                            <p>{feature.description}</p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
} 