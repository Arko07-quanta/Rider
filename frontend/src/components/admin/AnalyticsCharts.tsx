interface ChartData {
  label: string;
  value: number;
}

interface AnalyticsChartsProps {
  title: string;
  data: ChartData[];
  color?: string;
  type?: 'bar' | 'ranking';
}

export default function AnalyticsCharts({ title, data, color = "#22C55E", type = 'bar' }: AnalyticsChartsProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="analytics-card">
      <h3 className="chart-title">{title}</h3>
      
      <div className="chart-container">
        {type === 'bar' ? (
          <div className="bar-chart">
            {data.map((item, idx) => (
              <div key={idx} className="bar-wrapper">
                <div 
                  className="bar" 
                  style={{ 
                    height: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: color 
                  }}
                >
                  <span className="bar-value">{item.value}</span>
                </div>
                <span className="bar-label">{item.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="ranking-list">
            {data.map((item, idx) => (
              <div key={idx} className="ranking-item">
                <div className="ranking-info">
                  <span className="ranking-name">{item.label}</span>
                  <span className="ranking-count">{item.value} rides</span>
                </div>
                <div className="ranking-bar-bg">
                  <div 
                    className="ranking-bar-fill" 
                    style={{ 
                      width: `${(item.value / maxValue) * 100}%`,
                      backgroundColor: color 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .analytics-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 24px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .chart-title {
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        .chart-container {
          flex: 1;
          min-height: 200px;
        }

        /* Bar Chart Styles */
        .bar-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 200px;
          gap: 12px;
          padding-top: 20px;
        }

        .bar-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }

        .bar {
          width: 100%;
          max-width: 40px;
          border-radius: 4px 4px 0 0;
          position: relative;
          transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .bar-value {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 700;
          color: var(--text-main);
        }

        .bar-label {
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 8px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        /* Ranking List Styles */
        .ranking-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ranking-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ranking-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .ranking-name {
          color: var(--text-main);
          font-weight: 600;
        }

        .ranking-count {
          color: var(--text-secondary);
        }

        .ranking-bar-bg {
          height: 6px;
          background: var(--bg-surface);
          border-radius: 3px;
          overflow: hidden;
        }

        .ranking-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
