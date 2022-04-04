import React from "react";
import axios from "axios";
import JsonTable from "react-json-table-v2";
import "./App.css";

const BASE_URL = `https://fm.evenbytes.hr/`;
function App() {
  const [search, setSearch] = React.useState("SELECT * FROM ? LIMIT 1");
  const [result, setResult] = React.useState([]);

  const fetchResult = async () => {
    const res = await axios.post(`${BASE_URL}`, {
      query: search,
    });

    setResult(res.data);
  };
  React.useEffect(() => {
    fetchResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="App">
      <div className="Content">
        <h1>Skeleton Punks Explorer</h1>
        <div className="SearchContainer">
          <textarea
            rows={6}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          ></textarea>
          <div style={{ marginLeft: 10 }}></div>
          <button className="button" onClick={fetchResult}>
            Search
          </button>
        </div>
        <div>
          <div style={{ paddingBottom: 12, paddingTop: 12 }}>
            Example queries:
          </div>
          <div style={{ paddingBottom: 12 }}>
            <div>
              <b>Show all query fields :</b>
            </div>
            <div>SELECT * FROM ? LIMIT 1;</div>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <b>Get all on marketplace, show only 10 :</b>
            <div>SELECT * FROM ? WHERE priceUSD {">"} 1 LIMIT 10;</div>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <div>
              <b>Floor 10</b>
            </div>
            <div>
              SELECT tokenId, Background, Skull, Eyes, Clothes, Headwear,
              Accessory, name, priceUSD, rank, marketplaceURL FROM ? WHERE
              priceUSD {">"} 1 ORDER BY priceUSD ASC LIMIT 10;
            </div>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <div>
              <b>Top 10</b>
            </div>
            <div>
              SELECT tokenId, Background, Skull, Eyes, Clothes, Headwear,
              Accessory, name, priceUSD, rank, marketplaceURL FROM ? WHERE
              priceUSD {">"} 1 ORDER BY priceUSD DESC LIMIT 10 ;
            </div>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <div>
              <b>In price range between 350 and 600</b>
            </div>
            <div>
              SELECT tokenId, Background, Skull, Eyes, Clothes, Headwear,
              Accessory, name, priceUSD, rank, marketplaceURL FROM ? WHERE
              priceUSD {">="} 350 AND priceUSD {"<="} 600 ORDER BY priceUSD ASC LIMIT 10 ;
            </div>
          </div>

          <div style={{ paddingBottom: 12 }}>
            <div>
              <b>Complex queries example</b>
            </div>
            <div>
              SELECT tokenId, Background, Skull, Eyes, Clothes, Headwear,
              Accessory, name, priceUSD, rank, marketplaceURL FROM ? WHERE
              priceUSD {">"} 1 AND rank {">"} 6 AND Headwear LIKE '%Pirate%' LIMIT 10;
            </div>
          </div>

          <div style={{ paddingBottom: 12 }}>
            <div>
              <b>Marketplace price average</b>
              <div>SELECT AVG(priceUSD) as price FROM ? WHERE priceUSD;</div>
            </div>
          </div>
        </div>
        <div className="TableWrapper">
          <JsonTable rows={result} />
        </div>
      </div>
    </div>
  );
}

export default App;
